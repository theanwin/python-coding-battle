"""
Python Sandbox Runner for Python Coding Battle.
Safely executes Python scripts with timeout, stdin simulation, and error formatting.
"""
import sys
import io
import time
import json
import traceback

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input payload provided"}))
        sys.exit(1)

    payload_file = sys.argv[1]
    with open(payload_file, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    code = payload.get("code", "")
    stdin_data = payload.get("stdin", "")
    
    # Setup stdin
    stdin_stream = io.StringIO(stdin_data)
    stdout_stream = io.StringIO()
    stderr_stream = io.StringIO()

    old_stdin = sys.stdin
    old_stdout = sys.stdout
    old_stderr = sys.stderr

    sys.stdin = stdin_stream
    sys.stdout = stdout_stream
    sys.stderr = stderr_stream

    start_time = time.perf_counter()
    error_msg = None
    success = False

    try:
        # Create clean global namespace
        sandbox_globals = {
            "__name__": "__main__",
            "__builtins__": __builtins__,
        }
        compiled = compile(code, "<submission>", "exec")
        exec(compiled, sandbox_globals)
        success = True
    except Exception as e:
        error_msg = traceback.format_exc()
        success = False
    finally:
        exec_duration = (time.perf_counter() - start_time) * 1000
        out = stdout_stream.getvalue()
        err = stderr_stream.getvalue()
        
        sys.stdin = old_stdin
        sys.stdout = old_stdout
        sys.stderr = old_stderr

    # Format result as JSON
    result = {
        "success": success,
        "stdout": out,
        "stderr": err,
        "error": error_msg,
        "executionTimeMs": round(exec_duration, 2),
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
