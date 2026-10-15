import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import "next-auth/jwt";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/validations/auth";
import { verifyTotpOrBackupCode } from "@/lib/two-factor";
import { isTrustedDevice } from "@/lib/trusted-device";
import { hashMagicToken, looksLikeMagicToken } from "@/lib/magic-link";
import { effectiveRole } from "@/lib/roles";

/**
 * 2FA-signalen vanuit authorize (Fase 16-followup). CredentialsSignin-
 * subclasses behouden hun `code` door de NextAuth-error-laag heen, zodat de
 * login-action "wachtwoord goed maar code nodig" kan onderscheiden van
 * "ongeldige inloggegevens".
 */
export class TotpRequiredError extends CredentialsSignin {
  code = "totp_required";
}
export class TotpInvalidError extends CredentialsSignin {
  code = "totp_invalid";
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      accountType?: string;
      /** PLAYER | STAFF | ADMIN (Community Hub, Fase 2). */
      role?: string;
    };
  }
  interface User {
    accountType?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accountType?: string;
    role?: string;
  }
}

/** Snapshot van de login-IP (Fase 29, anti-shill-bidding). Nooit blokkerend. */
async function snapshotLoginIp(userId: string) {
  try {
    const reqHeaders = await headers();
    const ip =
      reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      reqHeaders.get("x-real-ip") ||
      null;
    if (ip) {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginIp: ip, lastLoginIpAt: new Date() },
      });
    }
  } catch {
    // Negeer — IP-tracking is niet kritiek voor de login-flow.
  }
}

function toAuthUser(user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  accountType: string;
  role: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    image: user.avatarUrl,
    accountType: user.accountType,
    role: effectiveRole(user),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA-code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: normalizeEmail(credentials.email as string) },
        });

        if (!user) return null;
        // Verwijderd account (AVG, Fase 2): nooit meer inloggen.
        if (user.deletedAt) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordMatch) return null;

        // 2FA (Fase 16-followup): wachtwoord klopt, maar bij totpEnabled is
        // ook een geldige TOTP- of backup-code vereist — tenzij dit apparaat
        // een geldige 30d trust-cookie heeft ("dit apparaat vertrouwen").
        // Aparte error-codes zodat de login-UI de 2FA-stap kan tonen i.p.v.
        // "ongeldige gegevens".
        if (user.totpEnabled && user.totpSecret) {
          const trusted = await isTrustedDevice(user.id, user.totpSecret);
          if (!trusted) {
            const totpCode = (credentials.totpCode as string | undefined)?.trim();
            if (!totpCode) throw new TotpRequiredError();
            const check = await verifyTotpOrBackupCode({
              code: totpCode,
              totpSecret: user.totpSecret,
              backupCodesJson: user.totpBackupCodes,
              consumeForUserId: user.id,
            });
            if (!check.valid) throw new TotpInvalidError();
          }
        }

        // Fase 29: snapshot login-IP voor anti-shill-bidding-detectie.
        await snapshotLoginIp(user.id);

        return toAuthUser(user);
      },
    }),
    // Inloglink per e-mail (Community Hub, Fase 2). De link uit de mail landt
    // op /magic?token=…; die pagina roept signIn("magic-link", { token }) aan.
    // Het token is eenmalig (usedAt) en 15 min geldig; alleen de hash staat
    // in de DB. 2FA wordt hier niet gevraagd: bezit van de mailbox is de
    // tweede factor, zoals bij een wachtwoord-reset.
    Credentials({
      id: "magic-link",
      name: "magic-link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = typeof credentials?.token === "string" ? credentials.token : null;
        if (!looksLikeMagicToken(token)) return null;
        const tokenHash = hashMagicToken(token);
        const now = new Date();
        // Claim-first: markeer als gebruikt in dezelfde query zodat twee
        // gelijktijdige klikken niet allebei inloggen.
        const claimed = await prisma.magicLinkToken.updateMany({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (claimed.count !== 1) return null;
        const row = await prisma.magicLinkToken.findUnique({ where: { tokenHash } });
        if (!row) return null;
        const user = await prisma.user.findUnique({ where: { email: row.email } });
        if (!user || user.deletedAt) return null;

        // Klik op de inloglink bewijst de mailbox: e-mail meteen geverifieerd.
        if (!user.emailVerifiedAt) {
          await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
        }
        await snapshotLoginIp(user.id);
        return toAuthUser(user);
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.picture = user.image;
        token.accountType = user.accountType;
        token.role = user.role;
      }
      // De JWT is een snapshot van het inlogmoment. Na een profielfoto- of
      // gebruikersnaamwijziging roept de header `update()` aan (trigger
      // "update") — dan lezen we naam + avatar opnieuw uit de DB, anders
      // blijft de header tot de volgende login de oude foto tonen.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { displayName: true, avatarUrl: true, accountType: true, role: true },
        });
        if (fresh) {
          token.name = fresh.displayName;
          token.picture = fresh.avatarUrl;
          token.accountType = fresh.accountType;
          token.role = effectiveRole(fresh);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.image = token.picture as string | null;
        session.user.accountType = token.accountType as string | undefined;
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
