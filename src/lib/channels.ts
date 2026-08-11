export type OrderChannelValue =
  | "FACEBOOK_MESSENGER"
  | "TELEGRAM"
  | "TIKTOK"
  | "VIBER"
  | "WALK_IN"
  | "OTHER";

export const ORDER_CHANNELS: OrderChannelValue[] = [
  "FACEBOOK_MESSENGER",
  "TELEGRAM",
  "TIKTOK",
  "VIBER",
  "WALK_IN",
  "OTHER",
];

export const CHANNEL_LABELS: Record<OrderChannelValue, string> = {
  FACEBOOK_MESSENGER: "Facebook Messenger",
  TELEGRAM: "Telegram Chat",
  TIKTOK: "TikTok Chat",
  VIBER: "Viber",
  WALK_IN: "Walk-in / Direct POS",
  OTHER: "Other",
};

/** Short labels for tight table cells and chips. */
export const CHANNEL_SHORT: Record<OrderChannelValue, string> = {
  FACEBOOK_MESSENGER: "Messenger",
  TELEGRAM: "Telegram",
  TIKTOK: "TikTok",
  VIBER: "Viber",
  WALK_IN: "Walk-in",
  OTHER: "Other",
};

export const CHANNEL_STYLES: Record<OrderChannelValue, string> = {
  FACEBOOK_MESSENGER: "bg-blue-100 text-blue-700",
  TELEGRAM: "bg-sky-100 text-sky-700",
  TIKTOK: "bg-fuchsia-100 text-fuchsia-700",
  VIBER: "bg-violet-100 text-violet-700",
  WALK_IN: "bg-gray-100 text-gray-600",
  OTHER: "bg-amber-100 text-amber-700",
};

export const DEFAULT_ORDER_CHANNEL: OrderChannelValue = "WALK_IN";

export const channelLabel = (value: string): string =>
  CHANNEL_LABELS[value as OrderChannelValue] ?? value;

export const isOrderChannel = (value: unknown): value is OrderChannelValue =>
  typeof value === "string" && ORDER_CHANNELS.includes(value as OrderChannelValue);
