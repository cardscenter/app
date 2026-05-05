import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

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
