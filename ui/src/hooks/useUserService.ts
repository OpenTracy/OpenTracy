import { useState, useCallback } from 'react';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import { getAmplifyClient } from '@/lib/amplifyClient';

type User = NonNullable<Schema['Users']['type']>;

function withTimeout<T>(p: Promise<T>, ms: number, msg = 'Auth timed out'): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export function useUserService() {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await withTimeout(fetchAuthSession(), 8000);
      const idTok = session?.tokens?.idToken?.toString() ?? null;
      const accessTok = session?.tokens?.accessToken?.toString() ?? null;
      const subFromToken = session?.tokens?.idToken?.payload?.sub as string | undefined;
      const emailFromToken = session?.tokens?.idToken?.payload?.email as string | undefined;
      const prefName = session?.tokens?.idToken?.payload?.preferred_username as string | undefined;

      const sub =
        subFromToken ??
        (await getCurrentUser()
          .then((u) => u.userId)
          .catch(() => undefined));

      setIdToken(idTok);
      setAccessToken(accessTok);

      if (!sub) {
        setUser(null);
        return { user: null, idToken: idTok, accessToken: accessTok };
      }

      const got = await getAmplifyClient().models.Users.get({ id: sub });
      if (got.errors?.length) {
        console.error('[useUserService] Users.get errors:', got.errors);
      }
      if (got.data) {
        setUser(got.data as User);
        return { user: got.data as User, idToken: idTok, accessToken: accessTok };
      }
      console.warn('[useUserService] Users.get returned no data for id:', sub);

      try {
        console.log('[useUserService] Attempting to create user record for:', sub);
        await getAmplifyClient().models.Users.create({
          id: sub,
          profileOwner: sub,
          email: emailFromToken ?? '',
          name: prefName ?? emailFromToken ?? sub,
        } as any);
        const after = await getAmplifyClient().models.Users.get({ id: sub });
        if (after.data) {
          setUser(after.data as User);
          return { user: after.data as User, idToken: idTok, accessToken: accessTok };
        }
        console.warn('[useUserService] User creation succeeded but get returned null');
      } catch (createErr) {
        console.warn('[useUserService] Could not create user record:', createErr);
      }

      setUser(null);
      return { user: null, idToken: idTok, accessToken: accessTok };
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
      setUser(null);
      setIdToken(null);
      setAccessToken(null);
      return { user: null, idToken: null, accessToken: null };
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, idToken, accessToken, loading, error, fetchUser };
}
