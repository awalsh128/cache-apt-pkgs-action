package exec

import (
	"encoding/json"
	"fmt"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/logging"
)

type Executor interface {
	// Executes a command and either returns the output or exits the programs and writes the output (including error) to STDERR.
	Exec(name string, arg ...string) *Execution
}

type Execution struct {
	Cmd      string
	Stdout   string
	Stderr   string
	ExitCode int
}

// Gets the error, if the command ran with a non-zero exit code.
func (e *Execution) Error() error {
	if e.ExitCode == 0 {
		return nil
	}
	return fmt.Errorf(
		"Error encountered running %s\nExited with status code %d; see combined output below:\n%s",
		e.Cmd,
		e.ExitCode,
		e.Stdout+e.Stderr,
	)
}

func DeserializeExecution(payload string) *Execution {
	var execution Execution
	json.Unmarshal([]byte(payload), &execution)
	return &execution
}

func (e *Execution) Serialize() string {
	bytes, err := json.MarshalIndent(e, "", " ")
	if err != nil {
		logging.Fatalf("Error encountered serializing Execution object.\n%s", err)
	}
	return string(bytes)
}
