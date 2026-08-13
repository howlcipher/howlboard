package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"time"
	"github.com/howlcipher/howlframe/observer"
)
//line server.howl:2
func next_task_id() string {
	defer observer.Trace("next_task_id", map[string]any{})()
//line server.howl:3
		{

//line server.howl:5
		{
			rec := 
			_ = rec
			n := 1
			_ = n
//line server.howl:7
		{
//line server.howl:8
		if  {
//line server.howl:9
		n = 1
		} else {
//line server.howl:10
		{
			v := rec["val"]
			_ = v
//line server.howl:11
		n = func() int { v, _ := strconv.Atoi(v); return v }()
		}
		}

//line server.howl:15
		return fmt.Sprint(n)

		}
		}

		}
}

func main() {
	defer func() {
		if r := recover(); r != nil {
			crashData := struct {
				Error string
				Stack string
			}{
				Error: fmt.Sprintf("%v", r),
				Stack: string(debug.Stack()),
			}
			dump, _ := json.Marshal(crashData)
			_ = os.WriteFile("crash.json", dump, 0644)
			os.Exit(1)
		}
	}()
	var _ = runtime.GOOS
	var _ = debug.Stack
	var _ = sql.Open
	var _ = os.Getenv
	var _ = json.Marshal
	var _ = io.ReadAll
	var _ = bytes.NewBuffer
	var _ = http.DefaultClient
	var _ = exec.Command
	var _ = regexp.MatchString
	var _ = strings.Split
	var _ = time.Sleep
	var _ = strconv.Atoi
	var _ = fmt.Println
	var _ = observer.Trace
	http.HandleFunc("/api/tasks", func(w http.ResponseWriter, mreq *http.Request) {
		defer observer.Trace("middleware_route:/api/tasks", map[string]any{"mreq": mreq.URL.Path})()
//line server.howl:23
		{
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
//line server.howl:27
		if (mreq.Method == "OPTIONS") {
//line server.howl:28
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(204)
		fmt.Fprint(w, "")
		} else {
//line server.howl:34
		{

//line server.howl:36
		{
			next_rec := 
			_ = next_rec
			max_id := 1
			_ = max_id
//line server.howl:38
		{
//line server.howl:39
		if  {
//line server.howl:40
		max_id = 1
		} else {
//line server.howl:41
		{
			v := next_rec["val"]
			_ = v
//line server.howl:42
		max_id = func() int { v, _ := strconv.Atoi(v); return v }()
		}
		}
//line server.howl:45
		{
			tasks := []string{}
			_ = tasks
			curr := 1
			_ = curr
//line server.howl:47
		{
//line server.howl:48
		for (curr < max_id) {
//line server.howl:49
		{
//line server.howl:50
		{
			t := 
			_ = t
//line server.howl:51
		if  {
//line server.howl:52
		{

		}
		} else {
//line server.howl:53
		tasks = append(tasks, t)
		}
		}
//line server.howl:56
		curr = (curr + 1)

		}
		}
//line server.howl:59
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode()

		}
		}

		}
		}

		}
		}

		}
	})
	http.HandleFunc("/api/tasks/create", func(w http.ResponseWriter, mreq *http.Request) {
		defer observer.Trace("middleware_route:/api/tasks/create", map[string]any{"mreq": mreq.URL.Path})()
//line server.howl:23
		{
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
//line server.howl:27
		if (mreq.Method == "OPTIONS") {
//line server.howl:28
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(204)
		fmt.Fprint(w, "")
		} else {
//line server.howl:70
		{
			var body TaskInput
			if parse_err := json.Unmarshal([]byte(mreq.body), &body); parse_err != nil {
//line server.howl:72
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		_ = json.NewEncoder(w).Encode()
			} else {
				_ = body
//line server.howl:74
		{
			title := body["title"]
			_ = title
//line server.howl:75
		if (title == "") {
//line server.howl:76
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		_ = json.NewEncoder(w).Encode()
		} else {
//line server.howl:77
		{
			id := next_task_id()
			_ = id
			task := map[string]string{"id": id, "title": title, "status": "open"}
			_ = task
//line server.howl:79
		{


//line server.howl:82
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(201)
		_ = json.NewEncoder(w).Encode(task)

		}
		}
		}
		}
			}
		}
		}

		}
	})
	http.HandleFunc("/api/tasks/complete", func(w http.ResponseWriter, mreq *http.Request) {
		defer observer.Trace("middleware_route:/api/tasks/complete", map[string]any{"mreq": mreq.URL.Path})()
//line server.howl:23
		{
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
//line server.howl:27
		if (mreq.Method == "OPTIONS") {
//line server.howl:28
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(204)
		fmt.Fprint(w, "")
		} else {
//line server.howl:92
		{
			var body TaskInput
			if parse_err := json.Unmarshal([]byte(mreq.body), &body); parse_err != nil {
//line server.howl:94
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		_ = json.NewEncoder(w).Encode()
			} else {
				_ = body
//line server.howl:96
		{
			id := body["id"]
			_ = id
//line server.howl:97
		if (id == "") {
//line server.howl:98
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		_ = json.NewEncoder(w).Encode()
		} else {
//line server.howl:99
		{

//line server.howl:101
		{
			task := 
			_ = task
//line server.howl:102
		if  {
//line server.howl:103
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(404)
		_ = json.NewEncoder(w).Encode()
		} else {
//line server.howl:104
		{
			title := task["title"]
			_ = title
			updated := map[string]string{"id": id, "title": title, "status": "done"}
			_ = updated
//line server.howl:106
		{

//line server.howl:108
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(updated)

		}
		}
		}
		}

		}
		}
		}
			}
		}
		}

		}
	})
	
	fmt.Println("Starting server on port 8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Println("Server error:", err)
	}
}
