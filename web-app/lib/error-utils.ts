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

export function parseContractError(error: any): ContractError {
  const errorMessage = error?.message || error?.reason || String(error);
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

export function showErrorToast(error: any, customTitle?: string) {
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
