import { ChatContext as ChatContextType, ChatMessage } from "@/types/chat";
import { SocketEvent } from "@/types/socket";
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { useSocket } from "./SocketContext";

const ChatContext = createContext<ChatContextType | null>(null);

export const useChatRoom = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error("useChatRoom must be used within a ChatContextProvider");
    }
    return context;
};

async function fetchAIResponse(message: string) {
    try {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('Gemini API key is not configured in VITE_OPENAI_API_KEY');
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: message }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!aiText) {
            throw new Error('Invalid response format from Google Gemini');
        }

        return aiText;
    } catch (error) {
        console.error('Error fetching AI response:', error);
        return error instanceof Error 
            ? `Error: ${error.message}`
            : "Sorry, I couldn't process your request at the moment.";
    }
}

function ChatContextProvider({ children }: { children: ReactNode }) {
    const { socket } = useSocket();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isNewMessage, setIsNewMessage] = useState<boolean>(false);
    const [lastScrollHeight, setLastScrollHeight] = useState<number>(0);
    const [isAITyping, setIsAITyping] = useState<boolean>(false);

    useEffect(() => {
        if (!socket) {
            console.error('Socket connection not available');
            return;
        }

        const handleMessage = async ({ message }: { message: ChatMessage }) => {
            try {
                setMessages((prevMessages) => [...prevMessages, message]);
                setIsNewMessage(true);

                if (message.message.toLowerCase().startsWith("@ai")) {
                    setIsAITyping(true);
                    const query = message.message.replace(/^@ai/i, "").trim();
                    
                    if (!query) {
                        const errorMessage: ChatMessage = {
                            id: `ai-${Date.now()}`,
                            username: "AI Assistant",
                            message: "Please provide a question or prompt after @ai",
                            timestamp: new Date().toISOString()
                        };
                        setMessages((prevMessages) => [...prevMessages, errorMessage]);
                        return;
                    }

                    const aiResponse = await fetchAIResponse(query);
                    const aiMessage: ChatMessage = {
                        id: `ai-${Date.now()}`,
                        username: "AI Assistant",
                        message: aiResponse,
                        timestamp: new Date().toISOString()
                    };
                    setMessages((prevMessages) => [...prevMessages, aiMessage]);
                }
            } catch (error) {
                console.error('Error in message handler:', error);
                const errorMessage: ChatMessage = {
                    id: `ai-error-${Date.now()}`,
                    username: "AI Assistant",
                    message: "Sorry, an error occurred while processing your request.",
                    timestamp: new Date().toISOString()
                };
                setMessages((prevMessages) => [...prevMessages, errorMessage]);
            } finally {
                setIsAITyping(false);
            }
        };

        socket.on(SocketEvent.RECEIVE_MESSAGE, handleMessage);

        return () => {
            socket.off(SocketEvent.RECEIVE_MESSAGE, handleMessage);
        };
    }, [socket]);

    return (
        <ChatContext.Provider
            value={{
                messages,
                setMessages,
                isNewMessage,
                setIsNewMessage,
                lastScrollHeight,
                setLastScrollHeight,
                isAITyping,  // ✅ Add this
                setIsAITyping, // ✅ Add this
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export { ChatContextProvider };
export default ChatContext;
