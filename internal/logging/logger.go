// Package logging provides structured logging functionality for the application.
package logging

import (
	"io"
	"log"
	"os"
	"path/filepath"

	"awalsh128.com/cache-apt-pkgs-action/internal/cio"
)

// Logger wraps the standard logger with additional functionality.
// It provides both file and stderr output, with optional debug logging.
type Logger struct {
	// wrapped is the underlying standard logger
	wrapped *log.Logger
	// Filename is the full path to the log file
	Filename string
	// Debug controls whether debug messages are logged
	Debug bool
	// file is the log file handle
	file *os.File
}

// Global logger instance used by package-level functions
var logger *Logger

// LogFilepath is the path where log files will be created
var LogFilepath = os.Args[0] + ".log"

// Init creates and initializes a new logger.
// It sets up logging to both a file and stderr, and enables debug logging if requested.
// The existing log file is removed to start fresh.
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

// DebugLazy logs a debug message using a lazy evaluation function.
// The message generator function is only called if debug logging is enabled,
// making it efficient for expensive debug message creation.
func DebugLazy(getLine func() string) {
	if logger.Debug {
		logger.wrapped.Println(getLine())
	}
}

// Debug logs a formatted debug message if debug logging is enabled.
// Uses fmt.Printf style formatting.
func Debug(format string, a ...any) {
	if logger.Debug {
		logger.wrapped.Printf(format, a...)
	}
}

func DumpVars(a ...any) {
	if logger.Debug {
		for _, v := range a {
			json, err := cio.ToJSON(v)
			if err != nil {
				Info("warning: unable to dump variable: %v", err)
				continue
			}
			logger.wrapped.Println(json)
		}
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
