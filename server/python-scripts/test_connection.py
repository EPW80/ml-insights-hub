#!/usr/bin/env python3
import json
import sys

def main():
    print(json.dumps({
        "status": "success",
        "message": "Python bridge is working correctly",
        "python_version": sys.version
    }))

if __name__ == "__main__":
    main()
