export const APP_UPDATE_VAR_KEY = "system_update";

export interface AppUpdate {
  seen: boolean;
  isNew: boolean;
  message: string;
}
