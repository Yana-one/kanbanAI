import { env_values, has_valid_firebase_env } from "./app_env";

/** Firebase SDK 초기화에 사용할 설정 객체 */
const firebase_config = {
  apiKey: env_values.firebase_api_key,
  authDomain: env_values.firebase_auth_domain,
  projectId: env_values.firebase_project_id,
  storageBucket: env_values.firebase_storage_bucket,
  messagingSenderId: env_values.firebase_messaging_sender_id,
  appId: env_values.firebase_app_id,
  measurementId: env_values.firebase_measurement_id,
};

/** Firebase 설정 유효성 검사 */
const validate_firebase_config = (): void => {
  if (!has_valid_firebase_env()) {
    console.error("[firebase_config] 필수 환경변수가 누락되었습니다.");
    throw new Error(
      "설정 정보를 불러오지 못했습니다. .env 값을 확인한 후 앱을 다시 실행해 주세요."
    );
  }
};

export { firebase_config, validate_firebase_config };
