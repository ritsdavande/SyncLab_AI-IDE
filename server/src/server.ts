import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent, SocketId } from "./types/socket"
import { USER_CONNECTION_STATUS, User } from "./types/user"
import { Server } from "socket.io"
import path from "path"
import { exec } from "child_process"
import fs from "fs"
import os from "os"
dotenv.config()

const app = express()

app.use(express.json())

app.use(cors())

app.use(express.static(path.join(__dirname, "..", "..", "client", "dist"))) // Serve static files

const server = http.createServer(app)
const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
	transports: ["websocket", "polling"], // Ensure WebSocket is included
	maxHttpBufferSize: 1e8,
	pingTimeout: 60000,
	pingInterval: 25000, // Add ping interval to keep connection alive
})

let userSocketMap: User[] = []

// Function to get all users in a room
function getUsersInRoom(roomId: string): User[] {
	return userSocketMap.filter((user) => user.roomId == roomId)
}

// Function to get room id by socket id
function getRoomId(socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId

	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

function getUserBySocketId(socketId: SocketId): User | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

io.on("connection", (socket) => {
	// Handle user actions
	socket.on(SocketEvent.JOIN_REQUEST, ({ roomId, username }) => {
		// Check is username exist in the room
		const isUsernameExist = getUsersInRoom(roomId).filter(
			(u) => u.username === username
		)
		if (isUsernameExist.length > 0) {
			io.to(socket.id).emit(SocketEvent.USERNAME_EXISTS)
			return
		}

		const user = {
			username,
			roomId,
			status: USER_CONNECTION_STATUS.ONLINE,
			cursorPosition: 0,
			typing: false,
			socketId: socket.id,
			currentFile: null,
		}
		userSocketMap.push(user)
		socket.join(roomId)
		socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user })
		const users = getUsersInRoom(roomId)
		io.to(socket.id).emit(SocketEvent.JOIN_ACCEPTED, { user, users })
	})

	socket.on("disconnecting", () => {
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.USER_DISCONNECTED, { user })
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		socket.leave(roomId)
	})

	// Handle file actions
	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		({ fileStructure, openFiles, activeFile, socketId }) => {
			io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, {
				fileStructure,
				openFiles,
				activeFile,
			})
		}
	)

	socket.on(
		SocketEvent.DIRECTORY_CREATED,
		({ parentDirId, newDirectory }) => {
			const roomId = getRoomId(socket.id)
			if (!roomId) return
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, {
				parentDirId,
				newDirectory,
			})
		}
	)

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, {
			dirId,
			children,
		})
	})

	socket.on(SocketEvent.DIRECTORY_RENAMED, ({ dirId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, {
			dirId,
			newName,
		})
	})

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
	})

	socket.on(SocketEvent.FILE_CREATED, ({ parentDirId, newFile }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
	})

	socket.on(SocketEvent.FILE_UPDATED, ({ fileId, newContent }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, {
			fileId,
			newContent,
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, {
			fileId,
			newName,
		})
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
	})

	// Handle user status
	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	// Handle chat actions
	socket.on(SocketEvent.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	// Handle cursor position
	socket.on(SocketEvent.TYPING_START, ({ cursorPosition }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: true, cursorPosition }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_START, { user })
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, {
			snapshot,
		})
	})
})

// Add error handling for socket connection
io.on("error", (error) => {
	console.error("Socket.io error:", error)
})

const PORT = process.env.PORT || 3000



const LANGUAGE_CONFIG: Record<string, { extension: string, compile?: (src: string, bin: string) => string, run: (bin: string) => string, aliases: string[], version: string, runtime?: string }> = {
	javascript: {
		extension: "js",
		run: (src) => `node ${src}`,
		aliases: ["node-javascript", "node-js", "javascript", "js"],
		version: "22.19.0",
		runtime: "node"
	},
	python: {
		extension: "py",
		run: (src) => `python ${src}`,
		aliases: ["py", "py3", "python3", "python3.10"],
		version: "3.10.0"
	},
	c: {
		extension: "c",
		compile: (src, bin) => `gcc ${src} -o ${bin}`,
		run: (bin) => bin,
		aliases: ["c"],
		version: "6.3.0"
	},
	cpp: {
		extension: "cpp",
		compile: (src, bin) => `g++ ${src} -o ${bin}`,
		run: (bin) => bin,
		aliases: ["cpp", "c++"],
		version: "6.3.0"
	},
	java: {
		extension: "java",
		compile: (src) => `javac ${src}`,
		run: (src) => `java -cp ${path.dirname(src)} Main`,
		aliases: ["java"],
		version: "11.0.25"
	},
	swift: {
		extension: "swift",
		compile: (src, bin) => `swiftc ${src} -o ${bin}`,
		run: (bin) => bin,
		aliases: ["swift"],
		version: "5.10"
	}
}

let wandboxCompilers: any[] = [];

app.get("/api/v2/piston/runtimes", async (req: Request, res: Response) => {
	try {
		const response = await fetch("https://wandbox.org/api/list.json")
		if (response.ok) {
			wandboxCompilers = await response.json()
			
			const runtimes = wandboxCompilers.map((c: any) => {
				const langName = c.language.toLowerCase()
				let language = langName;
				let aliases = [langName];
				
				if (langName === "c#") { language = "csharp"; aliases = ["csharp", "cs", "c#", "mono"]; }
				else if (langName === "c++") { language = "cpp"; aliases = ["cpp", "c++", "g++"]; }
				else if (langName === "bash script") { language = "bash"; aliases = ["bash", "sh"]; }
				else if (langName === "javascript") { language = "javascript"; aliases = ["js", "javascript", "node"]; }
				else if (langName === "python") { language = "python"; aliases = ["py", "python", "python3"]; }
				else if (langName === "ruby") { language = "ruby"; aliases = ["rb", "ruby"]; }
				else if (langName === "rust") { language = "rust"; aliases = ["rs", "rust"]; }
				else if (langName === "go") { language = "go"; aliases = ["go", "golang"]; }
				else if (langName === "php") { language = "php"; aliases = ["php"]; }
				
				return {
					language,
					version: c.version,
					aliases,
					runtime: c.name
				}
			})
			return res.json(runtimes)
		}
	} catch (error) {
		console.error("Failed to fetch runtimes from API, falling back to local...", error)
	}

	const runtimes = Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => ({
		language: lang,
		version: config.version,
		aliases: config.aliases,
		runtime: config.runtime
	}))
	res.json(runtimes)
})

app.post("/api/v2/piston/execute", async (req: Request, res: Response) => {
	const { language, version, files, stdin } = req.body
	if (!files || files.length === 0) {
		return res.status(400).json({ error: "No files provided" })
	}

	try {
		if (wandboxCompilers.length === 0) {
			const resp = await fetch("https://wandbox.org/api/list.json");
			if (resp.ok) wandboxCompilers = await resp.json();
		}

		let compilerName = "";
		if (wandboxCompilers.length > 0) {
			const match = wandboxCompilers.find((c: any) => {
				let langName = c.language.toLowerCase()
				if (langName === "c#") langName = "csharp"
				else if (langName === "c++") langName = "cpp"
				else if (langName === "bash script") langName = "bash"
				
				return langName === language.toLowerCase() && c.version === version
			})
			if (match) compilerName = match.name
		}

		if (compilerName) {
			const response = await fetch("https://wandbox.org/api/compile.json", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					compiler: compilerName,
					code: files[0].content,
					stdin: stdin || ""
				})
			})

			if (response.ok) {
				const data = await response.json()
				const stderr = data.compiler_error || data.program_error || ""
				
				if (stderr.includes("catatonit")) {
					console.warn(`Wandbox API returned catatonit error for ${language}. Falling back to local execution.`)
				} else {
					const stdout = data.program_message || data.compiler_output || ""
					
					return res.json({
						run: {
							stdout: stdout,
							stderr: stderr,
							code: parseInt(data.status || "0")
						}
					})
				}
			} else {
				console.warn(`Wandbox API returned status ${response.status}. Falling back to local execution.`)
			}
		}
	} catch (error) {
		console.error("Failed to execute via API, falling back to local...", error)
	}

	const code = files[0].content
	const config = LANGUAGE_CONFIG[language] || Object.values(LANGUAGE_CONFIG).find(c => c.aliases.includes(language))

	if (!config) {
		return res.status(400).json({ error: `Language ${language} is not supported on this local instance.` })
	}

	const isJava = language === "java"
	const ext = config.extension
	const tempDir = path.join(os.tmpdir(), `exec-${Date.now()}`)
	fs.mkdirSync(tempDir, { recursive: true })

	// For Java, the filename must be Main.java for simplicity
	const filename = isJava ? "Main.java" : `script.${ext}`
	const tempFile = path.join(tempDir, filename)
	const binFile = path.join(tempDir, isJava ? "" : `output.exe`)

	fs.writeFileSync(tempFile, code)

	const compileCmd = config.compile ? config.compile(tempFile, binFile) : null
	const runCmd = config.run(config.compile ? binFile : tempFile)

	const fullCommand = compileCmd ? `${compileCmd} && ${runCmd}` : runCmd

	const processExecution = exec(fullCommand, { timeout: 10000 }, (error, stdout, stderr) => {
		// Cleanup
		try {
			// On Windows, directories with active files might fail to delete immediately
			// We'll at least try to clean up the files we created
			fs.rmSync(tempDir, { recursive: true, force: true })
		} catch (e) {
			console.error("Cleanup error:", e)
		}

		res.json({
			run: {
				stdout: stdout || "",
				stderr: stderr || (error ? error.message : ""),
				code: error ? 1 : 0
			}
		})
	})

	if (stdin && processExecution.stdin) {
		processExecution.stdin.write(stdin)
		processExecution.stdin.end()
	}
})

app.get("*", (req: Request, res: Response) => {
	res.sendFile(path.join(__dirname, "..", "..", "client", "dist", "index.html"))
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
