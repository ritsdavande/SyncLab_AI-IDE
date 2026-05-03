import { useAppContext } from "@/context/AppContext"
import { useChatRoom } from "@/context/ChatContext"
import { SyntheticEvent, useEffect, useRef } from "react"

function ChatList() {
    const {
        messages,
        isNewMessage,
        setIsNewMessage,
        lastScrollHeight,
        setLastScrollHeight,
        isAITyping,  // ✅ Added isAITyping
    } = useChatRoom()
    const { currentUser } = useAppContext()
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)

    const handleScroll = (e: SyntheticEvent) => {
        const container = e.target as HTMLDivElement
        setLastScrollHeight(container.scrollTop)
    }

    useEffect(() => {
        if (!messagesContainerRef.current) return

        const container = messagesContainerRef.current
        const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight

        if (isAtBottom) {
            container.scrollTop = container.scrollHeight
        }
    }, [messages])

    useEffect(() => {
        if (isNewMessage) {
            setIsNewMessage(false)
        }
        if (messagesContainerRef.current)
            messagesContainerRef.current.scrollTop = lastScrollHeight
    }, [isNewMessage, setIsNewMessage, lastScrollHeight])

    return (
        <div
            className="flex-grow overflow-auto rounded-md bg-darkHover p-2"
            ref={messagesContainerRef}
            onScroll={handleScroll}
        >
            {messages.map((message, index) => {
                const isAIMessage = message.username === "Gemini AI";
                const isCurrentUser = message.username === currentUser.username;

                return (
                    <div
                        key={index}
                        className={`mb-2 w-[80%] break-words rounded-md px-3 py-2 ${
                            isAIMessage
                                ? "bg-green-900 text-white"
                                : isCurrentUser
                                ? "ml-auto bg-dark text-white"
                                : "bg-gray-800 text-white"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className={`text-xs ${
                                isAIMessage ? "text-green-300" : "text-primary"
                            }`}>
                                {message.username}
                            </span>
                            <span className="text-xs text-gray-400">
                                {message.timestamp}
                            </span>
                        </div>
                        <p className="whitespace-pre-wrap py-1">{message.message}</p>
                        {isAIMessage && (
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs text-green-300 italic">
                                    Gemini AI Response
                                </span>
                            </div>
                        )}
                    </div>
                )
            })}
            
            {/* ✅ Show AI typing indicator when AI is responding */}
            {isAITyping && (
                <div className="mb-2 w-[80%] break-words rounded-md px-3 py-2 bg-green-900 text-white">
                    <span className="text-xs text-green-300 italic">Gemini AI is typing...</span>
                </div>
            )}
        </div>
    )
}

export default ChatList
