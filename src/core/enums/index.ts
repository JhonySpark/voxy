export const ChannelTypeEnum = {
  TEXT: 'TEXT',
  VOICE: 'VOICE',
} as const;
export type ChannelTypeEnum = (typeof ChannelTypeEnum)[keyof typeof ChannelTypeEnum];

export const ServerRoleEnum = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER',
} as const;
export type ServerRoleEnum = (typeof ServerRoleEnum)[keyof typeof ServerRoleEnum];

export const DashboardView = {
  DM: 'DM',
  SERVER: 'SERVER',
} as const;
export type DashboardView = (typeof DashboardView)[keyof typeof DashboardView];

export const AppRoutes = {
  ROOT: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  APP: '/app',
} as const;
export type AppRoutes = (typeof AppRoutes)[keyof typeof AppRoutes];

export const StorageKeys = {
  AUTH_TOKEN: 'voxy_token',
  AUDIO_INPUT: 'voxy-audio-input',
  AUDIO_OUTPUT: 'voxy-audio-output',
  INPUT_SENSITIVITY: 'voxy-input-sensitivity',
  OUTPUT_VOLUME: 'voxy-output-volume',
  NOISE_SUPPRESSION: 'voxy-noise-suppression',
  ECHO_CANCELLATION: 'voxy-echo-cancellation',
  AUTO_GAIN: 'voxy-auto-gain',
  NOTIFY_MESSAGES: 'voxy-notify-messages',
  NOTIFY_SOUNDS: 'voxy-notify-sounds',
  RUN_IN_BACKGROUND: 'voxy-run-in-background',
  GAME_PRESENCE: 'voxy-game-presence',
  LANGUAGE: 'voxy-language',
} as const;
export type StorageKeys = (typeof StorageKeys)[keyof typeof StorageKeys];

export const RealtimeEvents = {
  // Direct Messages
  NEW_MESSAGE: 'newMessage',
  MESSAGE_SENT: 'messageSent',
  SEND_MESSAGE: 'sendMessage',
  MESSAGE_UPDATED: 'messageUpdated',
  EDIT_MESSAGE: 'editMessage',
  MESSAGE_REACTION_UPDATED: 'messageReactionUpdated',
  TOGGLE_MESSAGE_REACTION: 'toggleMessageReaction',

  // Channel Messages
  NEW_CHANNEL_MESSAGE: 'newChannelMessage',
  CHANNEL_MESSAGE_SENT: 'channelMessageSent',
  SEND_CHANNEL_MESSAGE: 'sendChannelMessage',
  CHANNEL_MESSAGE_DELETED: 'channelMessageDeleted',
  CHANNEL_MESSAGE_UPDATED: 'channelMessageUpdated',
  EDIT_CHANNEL_MESSAGE: 'editChannelMessage',
  CHANNEL_MESSAGE_REACTION_UPDATED: 'channelMessageReactionUpdated',
  TOGGLE_CHANNEL_MESSAGE_REACTION: 'toggleChannelMessageReaction',

  // Channels
  JOIN_CHANNEL: 'joinChannel',
  LEAVE_CHANNEL: 'leaveChannel',
  CHANNEL_CREATED: 'channelCreated',

  // Servers
  JOIN_SERVER: 'joinServer',
  LEAVE_SERVER: 'leaveServer',
  SERVER_UPDATED: 'serverUpdated',
  SERVER_DELETED: 'serverDeleted',
  SERVER_MEMBERS_UPDATED: 'serverMembersUpdated',
  SERVER_MEMBERSHIP_CHANGED: 'serverMembershipChanged',

  // Voice
  JOIN_VOICE: 'joinVoice',
  LEAVE_VOICE: 'leaveVoice',
  UPDATE_VOICE_MUTE: 'updateVoiceMute',
  SERVER_VOICE_UPDATE: 'serverVoiceUpdate',
  VOICE_STATE_UPDATE: 'serverVoiceUpdate',

  // Friends
  FRIEND_ACTION: 'friendAction',
  FRIEND_ACTION_UPDATE: 'friendActionUpdate',

  // User Profile & Status
  USER_PROFILE_UPDATED: 'userProfileUpdated',
  USER_STATUS_UPDATED: 'userStatusUpdate',
  GET_USER_STATUSES: 'getUserStatuses',
  ALL_USER_STATUSES: 'allUserStatuses',
  UPDATE_STATUS: 'updateStatus',
} as const;
export type RealtimeEvents = (typeof RealtimeEvents)[keyof typeof RealtimeEvents];

export const UserStatusEnum = {
  ONLINE: 'ONLINE',
  IDLE: 'IDLE',
  DND: 'DND',
  PLAYING: 'PLAYING',
  OFFLINE: 'OFFLINE',
} as const;
export type UserStatusEnum = (typeof UserStatusEnum)[keyof typeof UserStatusEnum];

export const StreamResolution = {
  HD_720: '720',
  FHD_1080: '1080',
} as const;
export type StreamResolution = (typeof StreamResolution)[keyof typeof StreamResolution];

export const StreamFramerate = {
  FPS_30: '30',
  FPS_60: '60',
} as const;
export type StreamFramerate = (typeof StreamFramerate)[keyof typeof StreamFramerate];

export const DesktopSourceType = {
  GAMES: 'games',
  WINDOWS: 'windows',
  SCREENS: 'screens',
} as const;
export type DesktopSourceType = (typeof DesktopSourceType)[keyof typeof DesktopSourceType];

export const ApiRoutes = {
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_CHECK_USERNAME: '/auth/check-username',
  AUTH_VERIFY_EMAIL: '/auth/verify-email',
  AUTH_RESEND_CODE: '/auth/resend-code',
  AUTH_SYNC_AGE_SIGNAL: '/auth/sync-age-signal',
  FRIENDS: '/friends',
  FRIEND_REQUESTS: '/friends/requests',
  FRIEND_REQUEST: '/friends/request',
  FRIEND_ACCEPT: '/friends/accept',
  FRIEND_REJECT: '/friends/reject',
  FRIEND_REMOVE: '/friends/remove',
  FRIEND_BLOCK: '/friends/block',
  FRIEND_UNBLOCK: '/friends/unblock',
  FRIEND_BLOCKED: '/friends/blocked',
  FRIEND_STATUS: '/friends/status',
  SERVERS: '/servers',
  SERVERS_JOIN: '/servers/join',
  CHANNELS: '/channels',
  CHAT: '/chat',
  USERS_ME: '/users/me',
  USERS_PROFILE: '/users/profile',
  USERS_CHANGE_PASSWORD: '/users/change-password',
} as const;
export type ApiRoutes = (typeof ApiRoutes)[keyof typeof ApiRoutes];

export const AgeClassificationEnum = {
  UNKNOWN: 'UNKNOWN',
  CHILD: 'CHILD',
  TEEN: 'TEEN',
  ADULT: 'ADULT',
} as const;
export type AgeClassificationEnum = (typeof AgeClassificationEnum)[keyof typeof AgeClassificationEnum];

export const ToastTypeEnum = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;
export type ToastTypeEnum = (typeof ToastTypeEnum)[keyof typeof ToastTypeEnum];

export const SettingsTabEnum = {
  ACCOUNT: 'account',
  VOICE: 'voice',
  APPEARANCE: 'appearance',
  NOTIFICATIONS: 'notifications',
  PRIVACY: 'privacy',
  KEYBINDS: 'keybinds',
} as const;
export type SettingsTabEnum = (typeof SettingsTabEnum)[keyof typeof SettingsTabEnum];

export const IpcChannels = {
  CHECK_FOR_UPDATES: 'CHECK_FOR_UPDATES',
  RESTART_AND_INSTALL: 'RESTART_AND_INSTALL',
  GET_UPDATE_STATUS: 'GET_UPDATE_STATUS',
  DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES: 'DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES',
  DESKTOP_CAPTURER_GET_SOURCES: 'DESKTOP_CAPTURER_GET_SOURCES',
  GET_BACKGROUND_MODE: 'GET_BACKGROUND_MODE',
  SET_BACKGROUND_MODE: 'SET_BACKGROUND_MODE',
  GET_OS_AGE_SIGNAL: 'GET_OS_AGE_SIGNAL',
  IS_NATIVE_STREAM_SUPPORTED: 'IS_NATIVE_STREAM_SUPPORTED',
  START_NATIVE_STREAM: 'START_NATIVE_STREAM',
  STOP_NATIVE_STREAM: 'STOP_NATIVE_STREAM',
  NATIVE_STREAM_LOG: 'NATIVE_STREAM_LOG',
  NATIVE_STREAM_TELEMETRY: 'NATIVE_STREAM_TELEMETRY',
  NATIVE_STREAM_STOPPED: 'NATIVE_STREAM_STOPPED',
  APP_UPDATE_CHECKING: 'app-update-checking',
  APP_UPDATE_AVAILABLE: 'app-update-available',
  APP_UPDATE_NOT_AVAILABLE: 'app-update-not-available',
  APP_UPDATE_PROGRESS: 'app-update-progress',
  APP_UPDATE_DOWNLOADED: 'app-update-downloaded',
  APP_UPDATE_ERROR: 'app-update-error',
} as const;
export type IpcChannels = (typeof IpcChannels)[keyof typeof IpcChannels];

export const AutoUpdaterEvents = {
  CHECKING_FOR_UPDATE: 'checking-for-update',
  UPDATE_AVAILABLE: 'update-available',
  UPDATE_NOT_AVAILABLE: 'update-not-available',
  DOWNLOAD_PROGRESS: 'download-progress',
  UPDATE_DOWNLOADED: 'update-downloaded',
  ERROR: 'error',
} as const;
export type AutoUpdaterEvents = (typeof AutoUpdaterEvents)[keyof typeof AutoUpdaterEvents];

export const AppUpdateStatus = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  DOWNLOADING: 'downloading',
  DOWNLOADED: 'downloaded',
  ERROR: 'error',
} as const;
export type AppUpdateStatus = (typeof AppUpdateStatus)[keyof typeof AppUpdateStatus];

export const LanguageEnum = {
  EN: 'en',
  PT: 'pt',
  ES: 'es',
} as const;
export type LanguageEnum = (typeof LanguageEnum)[keyof typeof LanguageEnum];

export const FriendshipStatusEnum = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;
export type FriendshipStatusEnum = (typeof FriendshipStatusEnum)[keyof typeof FriendshipStatusEnum];
