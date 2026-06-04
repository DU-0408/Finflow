import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:8000';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'FinFlow',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_GATEWAY_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const user = await res.json();
          return {
            id: String(user.id),
            name: user.username,
            email: user.username,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'finflow-dev-secret-change-in-production',
  trustHost: true,
});
