import { toast } from "@/hooks/use-toast";

export interface ContractError {
  code: string;
  message: string;
  userMessage: string;
  recovery?: string;
}

export const CONTRACT_ERRORS: Record<string, ContractError> = {
  // Abraham contract specific errors
  "Session not found": {
    code: "SESSION_NOT_FOUND",
    message: "Session not found",
    userMessage: "This creation session could not be found.",
    recovery: "Please check the URL and try again.",
  },
  "Message not found": {
    code: "MESSAGE_NOT_FOUND",
    message: "Message not found",
    userMessage: "This message could not be found.",
    recovery: "The message may have been removed or the link is incorrect.",
  },
  "Already praised": {
    code: "ALREADY_PRAISED",
    message: "Already praised",
    userMessage: "You have already praised this creation.",
    recovery: "You can only praise each creation once.",
  },
  "Incorrect ETH for praise": {
    code: "INCORRECT_PRAISE_AMOUNT",
    message: "Incorrect ETH for praise",
    userMessage: "Incorrect amount sent for praise.",
    recovery: "Please ensure you have enough ETH and try again.",
  },
  "Incorrect ETH for blessing": {
    code: "INCORRECT_BLESS_AMOUNT",
    message: "Incorrect ETH for blessing",
    userMessage: "Incorrect amount sent for blessing.",
    recovery: "Please ensure you have enough ETH and try again.",
  },
  "Content required": {
    code: "CONTENT_REQUIRED",
    message: "Content required",
    userMessage: "Message content is required.",
    recovery: "Please enter a message before submitting.",
  },
  "Media required": {
    code: "MEDIA_REQUIRED",
    message: "Media required",
    userMessage: "Media is required for this action.",
    recovery: "Please upload an image or media file.",
  },
  // Staking errors
  "Insufficient ABRAHAM balance": {
    code: "INSUFFICIENT_ABRAHAM_BALANCE",
    message: "Insufficient ABRAHAM balance",
    userMessage: "You do not have enough ABRAHAM tokens to stake.",
    recovery: "Please acquire more ABRAHAM tokens before staking.",
  },
  "Insufficient staked balance": {
    code: "INSUFFICIENT_STAKED_BALANCE",
    message: "Insufficient staked balance",
    userMessage: "You do not have enough staked ABRAHAM to unstake this amount.",
    recovery: "Please reduce the amount you wish to unstake.",
  },
  // Common blockchain errors
  "insufficient funds": {
    code: "INSUFFICIENT_FUNDS",
    message: "insufficient funds",
    userMessage: "Insufficient funds in your wallet.",
    recovery: "Please add more ETH to your wallet and try again.",
  },
  "user rejected": {
    code: "USER_REJECTED",
    message: "user rejected",
    userMessage: "Transaction was cancelled.",
    recovery: "Please approve the transaction to continue.",
  },
  "network error": {
    code: "NETWORK_ERROR",
    message: "network error",
    userMessage: "Network connection error.",
    recovery: "Please check your internet connection and try again.",
  },
  "gas estimation failed": {
    code: "GAS_ESTIMATION_FAILED",
    message: "gas estimation failed",
    userMessage: "Unable to estimate transaction cost.",
    recovery: "The transaction may fail. Please try again or contact support.",
  },
};

type UnknownError =
  | { message?: string; reason?: string }
  | string
  | Error
  | unknown;

export function parseContractError(error: UnknownError): ContractError {
  const errObj = error as
    | { message?: string; reason?: string }
    | Error
    | string
    | null
    | undefined;
  const errorMessage =
    (typeof errObj === "string"
      ? errObj
      : (errObj as Error)?.message ||
        (errObj as { reason?: string })?.reason) || String(errObj);
  const lowerMessage = errorMessage.toLowerCase();

  // Check for specific contract errors
  for (const [key, contractError] of Object.entries(CONTRACT_ERRORS)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return contractError;
    }
  }

  // Check for revert reasons in the error
  const revertMatch = errorMessage.match(/revert (.+?)(?:\n|$|,)/i);
  if (revertMatch) {
    const revertReason = revertMatch[1].trim();
    for (const [key, contractError] of Object.entries(CONTRACT_ERRORS)) {
      if (revertReason.toLowerCase().includes(key.toLowerCase())) {
        return contractError;
      }
    }
  }

  // Default error
  return {
    code: "UNKNOWN_ERROR",
    message: errorMessage,
    userMessage: "An unexpected error occurred.",
    recovery: "Please try again or contact support if the problem persists.",
  };
}

export function showErrorToast(error: UnknownError, customTitle?: string) {
  const contractError = parseContractError(error);

  toast({
    variant: "destructive",
    title: customTitle || "Transaction Failed",
    description: `${contractError.userMessage} ${contractError.recovery || ""}`,
  });
}

export function showSuccessToast(title: string, description?: string) {
  toast({
    variant: "success",
    title,
    description,
  });
}

export function showWarningToast(title: string, description?: string) {
  toast({
    variant: "warning",
    title,
    description,
  });
}

export function showInfoToast(title: string, description?: string) {
  toast({
    title,
    description,
  });
}
