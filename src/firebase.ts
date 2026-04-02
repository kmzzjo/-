import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert("보안 알림: 현재 Vercel 도메인이 Firebase에 등록되지 않았습니다.\n\nFirebase Console의 [Authentication] -> [Settings(설정)] -> [Authorized domains(승인된 도메인)]에 접속하신 Vercel 주소를 추가해주세요.");
    } else if (error.code === 'auth/popup-blocked') {
      alert("팝업이 차단되었습니다. 브라우저 주소창 우측에서 팝업 차단을 해제한 후 다시 시도해주세요.");
    } else {
      alert(`로그인 중 오류가 발생했습니다: ${error.message}`);
    }
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
