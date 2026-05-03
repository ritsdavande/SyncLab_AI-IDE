import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import { useSettings } from "@/context/SettingContext"
import { useSocket } from "@/context/SocketContext"
import usePageEvents from "@/hooks/usePageEvents"
import useResponsive from "@/hooks/useResponsive"
import { editorThemes } from "@/resources/Themes"
import { FileSystemItem } from "@/types/file"
import { SocketEvent } from "@/types/socket"
import { color } from "@uiw/codemirror-extensions-color"
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link"
import { LanguageName, loadLanguage } from "@uiw/codemirror-extensions-langs"
import CodeMirror, {
    Extension,
    ViewUpdate,
    scrollPastEnd,
} from "@uiw/react-codemirror"
import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { cursorTooltipBaseTheme, tooltipField } from "./tooltip"

function Editor() {
    const { users, currentUser } = useAppContext()
    const { activeFile, setActiveFile, updateFileContent } = useFileSystem()
    const { theme, language, fontSize } = useSettings()
    const { socket } = useSocket()
    const { viewHeight } = useResponsive()
    const [timeOutId, setTimeOutId] = useState<NodeJS.Timeout | null>(null)

    const filteredUsers = useMemo(
        () => users.filter((u) => u.username !== currentUser.username),
        [users, currentUser]
    )
    
    const [extensions, setExtensions] = useState<Extension[]>([])

    const onCodeChange = (code: string, view: ViewUpdate) => {
        if (!activeFile) return

        const updatedFile: FileSystemItem = { ...activeFile, content: code }
        setActiveFile(updatedFile)
        updateFileContent(activeFile.id, code)

        const cursorPosition = view.state.selection.main.head
        socket.emit(SocketEvent.TYPING_START, { cursorPosition })
        socket.emit(SocketEvent.FILE_UPDATED, {
            fileId: activeFile.id,
            newContent: code,
        })

        if (timeOutId) clearTimeout(timeOutId)
        
        setTimeOutId(
            setTimeout(() => socket.emit(SocketEvent.TYPING_PAUSE), 1000)
        )
    }

    // Prevent page reload on zoom gestures
    usePageEvents()

    useEffect(() => {
        const extensionsList: Extension[] = [
            color,
            hyperLink,
            tooltipField(filteredUsers),
            cursorTooltipBaseTheme,
            scrollPastEnd(),
        ]

        const langExt = loadLanguage(language.toLowerCase() as LanguageName)
        if (langExt) {
            extensionsList.push(langExt)
        } else {
            toast.error(
                `Syntax highlighting is unavailable for "${language}". Try selecting a different language in settings.`,
                { duration: 5000 }
            )
        }

        setExtensions(extensionsList)
    }, [filteredUsers, language])

    return (
        <div className="relative w-full h-full border border-gray-700 rounded-lg overflow-hidden bg-gray-900">
            <CodeMirror
                theme={editorThemes[theme]}
                onChange={onCodeChange}
                value={activeFile?.content || ""}
                extensions={extensions}
                minHeight="100%"
                maxWidth="100vw"
                style={{
                    fontSize: `${fontSize}px`,
                    height: viewHeight,
                    padding: "10px",
                }}
            />
        </div>
    )
}

export default Editor
