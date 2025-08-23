package logging

import (
	"io"
	"log"
	"os"
	"path/filepath"
)

type Logger struct {
	wrapped  *log.Logger
	Filename string
	Debug    bool
	file     *os.File
}

var logger *Logger

var LogFilepath = os.Args[0] + ".log"

func Init(filename string, debug bool) *Logger {
	os.Remove(LogFilepath)
	file, err := os.OpenFile(LogFilepath, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	cwd, _ := os.Getwd()

	logger = &Logger{
		// Logs to both stderr and file.
		// Stderr is used to act as a sidechannel of information and stay separate from the actual outputs of the program.
		wrapped:  log.New(io.MultiWriter(file, os.Stderr), "", log.LstdFlags),
		Filename: filepath.Join(cwd, file.Name()),
		Debug:    debug,
		file:     file,
	}
	Debug("Debug log created at %s", logger.Filename)
	return logger
}

func DebugLazy(getLine func() string) {
	if logger.Debug {
		logger.wrapped.Println(getLine())
	}
}

func Debug(format string, a ...any) {
	if logger.Debug {
		logger.wrapped.Printf(format, a...)
	}
}

func Info(format string, a ...any) {
	logger.wrapped.Printf(format+"\n", a...)
}

func Fatal(err error) {
	logger.wrapped.Fatal(err)
}

func Fatalf(format string, a ...any) {
	logger.wrapped.Fatalf(format+"\n", a...)
}
