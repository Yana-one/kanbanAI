import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebase_config, validate_firebase_config } from "./firebase_config";

/** Firebase 앱 인스턴스를 초기화하거나 재사용 */
const get_firebase_app = () => {
  validate_firebase_config();

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebase_config);
};

/** Firestore 인스턴스 */
const firestore_db = getFirestore(get_firebase_app());

export { firestore_db };
