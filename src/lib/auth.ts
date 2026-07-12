import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import "next-auth/jwt";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpOrBackupCode } from "@/lib/two-factor";

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
    };
  }
  interface User {
    accountType?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accountType?: string;
  }
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
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordMatch) return null;

        // 2FA (Fase 16-followup): wachtwoord klopt, maar bij totpEnabled is
        // ook een geldige TOTP- of backup-code vereist. Aparte error-codes
        // zodat de login-UI de 2FA-stap kan tonen i.p.v. "ongeldige gegevens".
        if (user.totpEnabled && user.totpSecret) {
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

        // Fase 29: snapshot login-IP voor anti-shill-bidding-detectie. Wordt
        // door placeBid gebruikt om hard-block te triggeren als een bidder
        // hetzelfde netwerk als de seller deelt. Headers() werkt in NextAuth
        // callbacks (server-context). Falen we de IP te bepalen, dan slaan
        // we de update gewoon over — login mag daarop niet vastlopen.
        try {
          const reqHeaders = await headers();
          const ip =
            reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            reqHeaders.get("x-real-ip") ||
            null;
          if (ip) {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginIp: ip, lastLoginIpAt: new Date() },
            });
          }
        } catch {
          // Negeer — IP-tracking is niet kritiek voor de login-flow.
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
          accountType: user.accountType,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.picture = user.image;
        token.accountType = user.accountType;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.image = token.picture as string | null;
        session.user.accountType = token.accountType as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
