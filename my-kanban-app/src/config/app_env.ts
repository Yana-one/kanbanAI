/** 앱에서 사용하는 환경변수 상수 */
const env_values = {
  firebase_api_key: process.env.REACT_APP_FIREBASE_API_KEY ?? "",
  firebase_auth_domain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ?? "",
  firebase_project_id: process.env.REACT_APP_FIREBASE_PROJECT_ID ?? "",
  firebase_storage_bucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ?? "",
  firebase_messaging_sender_id:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ?? "",
  firebase_app_id: process.env.REACT_APP_FIREBASE_APP_ID ?? "",
  firebase_measurement_id: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID ?? "",
};

/** Firebase 설정에 필요한 값이 모두 있는지 검사 */
const has_valid_firebase_env = (): boolean => {
  const required_values = [
    env_values.firebase_api_key,
    env_values.firebase_auth_domain,
    env_values.firebase_project_id,
    env_values.firebase_storage_bucket,
    env_values.firebase_messaging_sender_id,
    env_values.firebase_app_id,
  ];

  return required_values.every((value) => value.trim().length > 0);
};

export { env_values, has_valid_firebase_env };
