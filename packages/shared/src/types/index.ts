export interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}
