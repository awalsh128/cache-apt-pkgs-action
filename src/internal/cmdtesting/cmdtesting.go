package cmdtesting

import (
	"os"
	"os/exec"
	"strings"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/common"
)

const binaryName = "apt_query"

type CmdTesting struct {
	*testing.T
	createReplayLogs bool
	replayFilename   string
}

func New(t *testing.T, createReplayLogs bool) *CmdTesting {
	replayFilename := "testlogs/" + strings.ToLower(t.Name()) + ".log"
	if createReplayLogs {
		os.Remove(replayFilename)
		os.Remove(binaryName + ".log")
	}
	return &CmdTesting{t, createReplayLogs, replayFilename}
}

type RunResult struct {
	Testing     *CmdTesting
	Combinedout string
	Err         error
}

func TestMain(m *testing.M) {
	cmd := exec.Command("go", "build")
	out, err := cmd.CombinedOutput()
	if err != nil {
		panic(string(out))
	}
	os.Exit(m.Run())
}

func (t *CmdTesting) Run(command string, pkgNames ...string) RunResult {
	replayfile := "testlogs/" + strings.ToLower(t.Name()) + ".log"

	flags := []string{"-debug=true"}
	if !t.createReplayLogs {
		flags = append(flags, "-replayfile="+replayfile)
	}

	cmd := exec.Command("./"+binaryName, append(append(flags, command), pkgNames...)...)
	combinedout, err := cmd.CombinedOutput()

	if t.createReplayLogs {
		err := common.AppendFile(binaryName+".log", t.replayFilename)
		if err != nil {
			t.T.Fatalf("Error encountered appending log file.\n%s", err.Error())
		}
	}

	return RunResult{Testing: t, Combinedout: string(combinedout), Err: err}
}

func (r *RunResult) ExpectSuccessfulOut(expected string) {
	if r.Testing.createReplayLogs {
		r.Testing.Log("Skipping test while creating replay logs.")
		return
	}

	if r.Err != nil {
		r.Testing.Errorf("Error running command: %v\n%s", r.Err, r.Combinedout)
		return
	}
	fullExpected := expected + "\n" // Output will always have a end of output newline.
	if r.Combinedout != fullExpected {
		r.Testing.Errorf("Unexpected combined std[err,out] found.\nExpected:\n'%s'\nActual:\n'%s'", fullExpected, r.Combinedout)
	}
}

func (r *RunResult) ExpectError(expectedCombinedout string) {
	if r.Testing.createReplayLogs {
		r.Testing.Log("Skipping test while creating replay logs.")
		return
	}

	fullExpectedCombinedout := expectedCombinedout + "\n" // Output will always have a end of output newline.
	if r.Combinedout != fullExpectedCombinedout {
		r.Testing.Errorf("Unexpected combined std[err,out] found.\nExpected:\n'%s'\nActual:\n'%s'", fullExpectedCombinedout, r.Combinedout)
	}
}
