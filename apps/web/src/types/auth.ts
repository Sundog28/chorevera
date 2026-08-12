export type User = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
};


export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};


export type LoginInput = {
  email: string;
  password: string;
};


export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};


export type AuthMessageResponse = {
  message: string;
  development_url?: string | null;
};


export type RegistrationResponse = {
  user: User;
  message: string;
  development_url?: string | null;
};


export type ApiValidationError = {
  loc: Array<
    string | number
  >;
  msg: string;
  type: string;
};


export type ApiErrorResponse = {
  detail?:
    | string
    | ApiValidationError[];
};
