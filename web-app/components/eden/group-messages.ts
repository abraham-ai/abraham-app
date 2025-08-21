import { Message } from "@edenlabs/eden-sdk";

export function groupConsecutiveMessages(messages: Message[]): Message[][] {
  if (!messages.length) return [];
  if (messages.length === 1) return [[messages[0]]];

  const groups: Message[][] = [];
  let currentGroup: Message[] = [];

  messages.forEach((message, index) => {
    if (index === 0) {
      currentGroup.push(message);
      return;
    }

    const previousMessage = messages[index - 1];

    if (message.sender?.username === previousMessage.sender?.username) {
      currentGroup.push(message);
    } else {
      groups.push([...currentGroup]);
      currentGroup = [message];
    }

    // If this is the last message, add the current group
    if (index === messages.length - 1) {
      groups.push([...currentGroup]);
    }
  });

  return groups;
}
