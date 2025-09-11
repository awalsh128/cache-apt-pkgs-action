package main

import (
	"fmt"
	"log"
	"os"
)

func Foo(action Action) {
	converter := NewBashConverter(action)
	bashScript := converter.Convert()
	fmt.Println(bashScript)
	const out = "action.sh"
	if err := os.WriteFile(out, []byte(bashScript), 0o755); err != nil {
		fmt.Println("write error:", err)
		os.Exit(1)
	}
	fmt.Printf("Wrote script to %s\n", out)
}

func main() {
	action, err := Parse("../../action.yml")
	if err != nil {
		log.Fatal(err)
	}

	txt, err := ParseAndGetAst(action)

	fmt.Println(txt)
}
