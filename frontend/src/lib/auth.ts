import type { NextAuthOptions } from 'next-auth';
import FacebookProvider from 'next-auth/providers/facebook';
import GoogleProvider from 'next-auth/providers/google';

const providers: NextAuthOptions['providers'] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/setup',
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.provider = typeof token.provider === 'string' ? token.provider : undefined;
        session.user.providerAccountId =
          typeof token.providerAccountId === 'string' ? token.providerAccountId : undefined;
      }

      return session;
    },
  },
};
