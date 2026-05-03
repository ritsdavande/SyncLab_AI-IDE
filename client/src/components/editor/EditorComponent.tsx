import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import cn from "classnames"
import Editor from "./Editor"
import FileTab from "./FileTab"

function EditorComponent() {
    const { openFiles } = useFileSystem()
    const { minHeightReached } = useResponsive()

    if (openFiles.length <= 0) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="flex flex-col items-center justify-center p-6 bg-gray-700 rounded-lg shadow-lg">
                    <h1 className="text-xl font-semibold text-white">
                        No file is currently open
                    </h1>
                    <p className="text-gray-300 mt-2">
                        Select or create a file to start editing.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <main
            className={cn(
                "flex w-full flex-col overflow-hidden border border-gray-700 rounded-lg shadow-lg bg-gray-900",
                {
                    "h-[calc(100vh-50px)]": !minHeightReached,
                    "h-full": minHeightReached,
                }
            )}
        >
            <FileTab />
            <Editor />
        </main>
    )
}

export default EditorComponent
