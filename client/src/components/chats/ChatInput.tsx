import { useAppContext } from "@/context/AppContext";
import { useChatRoom } from "@/context/ChatContext";
import { useSocket } from "@/context/SocketContext";
import { ChatMessage } from "@/types/chat";
import { SocketEvent } from "@/types/socket";
import { formatDate } from "@/utils/formateDate";
import { FormEvent, useRef, useState } from "react";
import { LuSendHorizonal } from "react-icons/lu";
import { v4 as uuidV4 } from "uuid";
import { getAIResponse } from "@/services/aiService";

function ChatInput() {
    const { currentUser } = useAppContext();
    const { socket } = useSocket();
    const { setMessages } = useChatRoom();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isAIProcessing, setIsAIProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = (message: string, isAIMessage = false) => {
        const newMessage: ChatMessage = {
            id: uuidV4(),
            message,
            username: isAIMessage ? "Gemini" : currentUser.username,
            timestamp: formatDate(new Date().toISOString()),
        };

        if (!isAIMessage) {
            socket.emit(SocketEvent.SEND_MESSAGE, { message: newMessage });
        }
        setMessages((messages) => [...messages, newMessage]);
    };

    const handleAIRequest = async (query: string) => {
        try {
            setIsAIProcessing(true);
            setError(null);

            const { response, error } = await getAIResponse(query);

            if (error) {
                setError(error);
                sendMessage("Sorry, I couldn't process your request at the moment.", true);
                return;
            }

            if (response) {
                sendMessage(response, true);
            }
        } finally {
            setIsAIProcessing(false);
        }
    };

    const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const inputVal = inputRef.current?.value.trim();
        if (!inputVal || inputVal.length === 0) return;

        // Send user message first
        sendMessage(inputVal);

        // Check for AI command
        if (inputVal.toLowerCase().startsWith("@ai")) {
            const query = inputVal.slice(3).trim();
            if (query) {
                await handleAIRequest(query);
            } else {
                sendMessage("Please provide a question after @ai", true);
            }
        }

        // Clear input
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {error && (
                <div className="text-xs text-red-400 italic">
                    {error}
                </div>
            )}
            <form
                onSubmit={handleSendMessage}
                className="flex justify-between rounded-md border border-primary"
            >
                <input
                    type="text"
                    className="w-full flex-grow rounded-md border-none bg-dark p-2 outline-none"
                    placeholder={isAIProcessing ? "AI is thinking..." : "Type @ai followed by your question..."}
                    ref={inputRef}
                    disabled={isAIProcessing}
                />
                <button
                    className="flex items-center justify-center rounded-r-md bg-primary p-2 text-black disabled:opacity-50"
                    type="submit"
                    disabled={isAIProcessing}
                >
                    <LuSendHorizonal size={24} />
                </button>
            </form>
            {isAIProcessing && (
                <div className="text-xs text-primary italic">
                    Gemini is thinking...
                </div>
            )}
        </div>
    );
}

export default ChatInput;
