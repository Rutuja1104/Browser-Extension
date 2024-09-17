export const SYSTEM_URL_REGEXP = {
  "athenaNet": /https:\/\/.+\.athenahealth\.com/,
  "practiceFusion": /https:\/\/.+\.practicefusion\.com/,
  "eClinicalWorks": /https:\/\/.+\.ecwcloud\.com/,
  "openEmr": /https:\/\/openemr.*\.insiteflow\.io/,
  "eclinicalweb": /https:\/\/sandbox.eclinicalweb\.com/,
};
export const USER_CONTEXT = "user_context";
export const WS_EVENT = "https://insiteflow.io/ws-event";
export const WS_PAYLOAD = "https://insiteflow.io/ws-payload";
export const WS_ID ="https://insiteflow.io/ws-id";
export const WS_TS = "https://insitefow.io/ws-ts";
export const IDP_INSITEFLOW = "idp:Insiteflow";
export const AUDIT_LOG = "audit_logs";
export const WEBSOCKET_CONNECTED = "websocket_connected";
export const DEFAULT_CONFIG='default_config';
export const UPDATED_CONFIG = "updated_config";
export const ENABLEMENT_KEY_SUCCESFUL = "enablement_key_succesful";
export const CONTAINER_LAUNCH= "container_launch";
export const METADATA = "https://insiteflow.io/ws-metadata";
export const WS_PRALLEL = "https://insiteflow.io/ws-parallel";
export const WS_PROXY = "https://insiteflow.io/ws-proxy";
export const WS_COREELATION_ID  = "https://insiteflow.io/ws-correlation_id";
export const VIEWPORT_MAXIMISED ="viewport_maximized";
export const VIEWPORT_MINIMISED ="viewport_minimized";
export const VIEWPORT_QUITED ="viewport_quited";
export const VIEWPORT_CLOSED ="viewport_closed";
export const VIEWPORT_DRAGGED ="viewport_dragged";
export const VIEWPORT_SWITCHED ="viewport_switched";
export const VIEWPORT_OPENED ="viewport_opened";
export const NOTIFICATION_ACKNOWLEDGED ="notification_acknowledged";//when notification clicked
export const NOTIFICATION_DISPLAYED ="notification_displayed";//when notification appear
export const NOTIFICATION_SKIPPED ="notification_skipped";//when notification is not appear due to open state of viewport
export const NOTIFICATION_DISMISSED ="notification_dismissed";// when click on X icon of notification
export const CONTAINER_COUNDWATCH_LOGS= "containers_cloudwatch_logs";
export const CONTAINER_INFO ="container_info";
export const NOTIFICATION_CLOSED = "notification_closed"; // when second event is occured
export const GET_COUNTS_FOR_USER_CONTEXT="get-counts-for-user-context";
export const GET_NOTIFICATION_DATA_FOR_USER_CONTEXT="get-notification-data-for-user-context";
export const API_MIX_PANEL_URL="https://api.mixpanel.com";
export const WS_NETWORKID= "https://insiteflow.io/ws-networkId";
export const REMOVED_CONFIG = "removed_config";
export const CONTEXT_EXPIRED = "context_expired";
export const NO_OP = 'No_Op';
export const API_IP_ADDRESS_URL = 'https://api.ipify.org';
