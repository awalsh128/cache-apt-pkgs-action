package logging

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
)

type Logger struct {
	wrapped  *log.Logger
	Filename string
	Debug    bool
}

var logger *Logger

var LogFilepath = os.Args[0] + ".log"

func Init(filename string, debug bool) *Logger {
	os.Remove(LogFilepath)
	file, err := os.OpenFile(LogFilepath, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
		os.Exit(2)
	}
	cwd, _ := os.Getwd()
	logger = &Logger{
		wrapped:  log.New(file, "", log.LstdFlags),
		Filename: filepath.Join(cwd, file.Name()),
		Debug:    debug,
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

func Fatal(err error) {
	fmt.Fprintf(os.Stderr, "%s", err.Error())
	logger.wrapped.Fatal(err)
}

func Fatalf(format string, a ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", a...)
	logger.wrapped.Fatalf(format, a...)
}
