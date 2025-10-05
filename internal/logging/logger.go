package logging

import (
	"io"
	"log"
	"os"
	"sync"

	"awalsh128.com/cache-apt-pkgs-action/internal/cio"
)

// loggerWrapper encapsulates a standard logger with additional functionality.
type loggerWrapper struct {
	wrapped *log.Logger // The underlying standard logger
}

// DebugEnabled controls whether debug messages are logged.
// When true, Debug() calls will output messages; when false, they are ignored.
var DebugEnabled = false

var (
	loggerMu sync.Mutex // Protects logger operations
	logger   = createDefault()
)

// create instantiates a new logger with the specified output writers.
// Multiple writers can be provided to output logs to multiple destinations.
func create(writers ...io.Writer) loggerWrapper {
	loggerMu.Lock()
	defer loggerMu.Unlock()
	return loggerWrapper{
		wrapped: log.New(io.MultiWriter(writers...), "", log.LstdFlags),
	}
}

// createDefault provides the default behavior for the log Go module
func createDefault() loggerWrapper {
	return create(os.Stderr)
}

// SetOutput overrides the default output destination for the logger.
// This affects all subsequent log messages from this package.
// Thread-safe operation that can be called at any time.
func SetOutput(writer io.Writer) {
	logger.wrapped.SetOutput(writer)
}

func recreateFileWriter() *os.File {
	logFilepath := os.Args[0] + ".log"
	// Ignore error if file doesn't exist
	_ = os.Remove(logFilepath)
	file, err := os.OpenFile(logFilepath, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	return file
}

// InitDefault resets the logger to its default state, writing only to stderr.
// Any existing log files or custom writers are discarded.
func InitDefault() {
	DebugEnabled = false
	logger = createDefault()
}

// Init initializes a new logger that writes to both a file and stderr.
// The log file is named after the binary with a .log extension.
// Previous log file content is discarded.
//
// Parameters:
//   - debug: Enable or disable debug logging
func Init(debug bool) {
	file := recreateFileWriter()
	DebugEnabled = debug
	logger = create(file, os.Stderr)
}

// InitWithWriter initializes a new logger with custom output writers.
// Writes to both a log file and the specified writer.
//
// Parameters:
//   - debug: Enable or disable debug logging
//   - writer: Additional output destination besides the log file
func InitWithWriter(debug bool, writer io.Writer) {
	file := recreateFileWriter()
	DebugEnabled = debug
	logger = create(file, writer)
}

// DebugLazy logs a debug message using a lazy evaluation function.
// The message generator function is only called if debug logging is enabled,
// making it efficient for expensive debug message creation.
//
// The getLine function should return the message to be logged.
func DebugLazy(getLine func() string) {
	if DebugEnabled {
		logger.wrapped.Println(getLine())
	}
}

// Debug logs a formatted debug message if debug logging is enabled.
// Uses fmt.Printf style formatting. No-op if debug is disabled.
//
// Parameters:
//   - format: Printf-style format string
//   - a: Arguments for the format string
func Debug(format string, a ...any) {
	if DebugEnabled {
		logger.wrapped.Printf(format, a...)
	}
}

// DumpVars logs the JSON representation of variables if debug is enabled.
// Each variable is converted to JSON format before logging.
// Continues to next variable if one fails to convert.
func DumpVars(a ...any) {
	if DebugEnabled {
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

// Info logs a formatted message at info level.
// Always logs regardless of debug setting.
// Adds a newline to the end of the message.
func Info(format string, a ...any) {
	logger.wrapped.Printf(format+"\n", a...)
}

// Fatal logs an error message and terminates the program.
// Calls os.Exit(1) after logging the error.
func Fatal(err error) {
	logger.wrapped.Fatal(err)
}

func Fatalf(format string, a ...any) {
	logger.wrapped.Fatalf(format+"\n", a...)
}
