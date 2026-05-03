interface ChatMessage {
    id: string
    message: string
    username: string
    timestamp: string
}

interface ChatContext {
    messages: ChatMessage[]
    setMessages: (
        messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[]),
    ) => void
    isNewMessage: boolean
    setIsNewMessage: (isNewMessage: boolean) => void
    lastScrollHeight: number
    setLastScrollHeight: (lastScrollHeight: number) => void
    isAITyping: boolean;  // ✅ Add this
    setIsAITyping: React.Dispatch<React.SetStateAction<boolean>>; 
}

export { ChatContext, ChatMessage }
