import { Creator } from "../Creators";
import { Agent, SessionV2, ToolCall } from "./index";

export type MessageReaction = {
  [key: string]: (string | number | boolean | Date | null)[];
};

type ChannelType = "eden" | "discord" | "telegram" | "twitter";

export type Channel = {
  type: ChannelType;
  key: string;
};

export type MessageRole = "user" | "assistant" | "system" | "tool" | "eden";

export type EdenMessageType = "agent_add" | "agent_remove";

export type EdenMessageAgentData = {
  id: string;
  name: string;
  avatar?: string;
};

export type EdenMessageData = {
  message_type: EdenMessageType;
  agents?: EdenMessageAgentData[];
};

export type Message = {
  _id: string;
  session: SessionV2;
  sender: Creator | Agent;
  role: MessageRole;
  eden_message_data?: EdenMessageData;
  content: string;
  name?: string;
  tool_call_id?: string;
  channel?: Channel;
  reply_to?: Message;
  sender_name?: string;
  reactions?: MessageReaction;
  attachments?: string[];
  tool_calls?: ToolCall[];
  createdAt: Date;
  updatedAt: Date;
};
