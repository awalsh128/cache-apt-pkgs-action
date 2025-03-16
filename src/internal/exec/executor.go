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
	Cmd         string
	CombinedOut string
	ExitCode    int
}

// Gets the error, if the command ran with a non-zero exit code.
func (e *Execution) Error() error {
	if e.ExitCode == 0 {
		return nil
	}
	return fmt.Errorf(
		"Error encountered running %s\nExited with status code %d; see combined std[out,err] below:\n%s",
		e.Cmd,
		e.ExitCode,
		e.CombinedOut,
	)
}

func DeserializeExecution(payload string) *Execution {
	var execution Execution
	err := json.Unmarshal([]byte(payload), &execution)
	if err != nil {
		logging.Fatalf("Error encountered deserializing Execution object.\n%s", err)
	}
	return &execution
}

func (e *Execution) Serialize() string {
	bytes, err := json.MarshalIndent(e, "", " ")
	if err != nil {
		logging.Fatalf("Error encountered serializing Execution object.\n%s", err)
	}
	return string(bytes)
}
