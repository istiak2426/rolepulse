import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const provider = new GoogleAuthProvider();
for (const scope of GMAIL_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory only access token cache (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google sign-in completed, but no Gmail access token was returned.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: any) {
    if (err?.code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      throw new Error(
        `ডোমেইনটি (${host}) Firebase Auth-এ অনুমোদিত নয়। Firebase Console → Authentication → Settings → Authorized domains-এ "${host}" যোগ করুন।`
      );
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogle = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

export { auth };
