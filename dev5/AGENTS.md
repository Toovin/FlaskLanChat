# Agent Guidelines for FlaskLanChat

## Build/Lint/Test Commands
- **Run server**: `python server_v5.py`
- **Run single test**: `python test_<test_name>.py` (e.g., `python test_command_execution.py`)
- **Install dependencies**: `pip install -r requirements.txt`
- **No formal linting configured** - consider adding black/flake8/mypy
- **No formal testing framework** - tests are standalone Python scripts

## Code Style Guidelines

### Imports
- Standard library imports first
- Third-party imports second
- Local imports last
- One import per line
- Use absolute imports for local modules

### Naming Conventions
- **Variables/Functions**: snake_case (e.g., `user_name`, `process_message()`)
- **Constants**: ALL_CAPS (e.g., `UPLOAD_DIR`, `SECRET_KEY`)
- **Classes**: PascalCase (if any)
- **Files**: snake_case with .py extension

### Error Handling
- Use try/except blocks with specific exception types
- Log errors with descriptive messages using print()
- Return False/None on failure, True/success data on success
- Validate inputs before processing

### File Operations
- Use `os.makedirs(path, exist_ok=True)` for directory creation
- Use `werkzeug.utils.secure_filename()` for uploaded files
- Check file existence with `os.path.exists()` before operations

### Security
- Use `os.urandom()` for secret keys
- Set secure cookie attributes (HttpOnly, Secure, SameSite)
- Validate and sanitize all user inputs
- Never log sensitive information

### Database
- Use parameterized queries to prevent SQL injection
- Handle database connections properly with try/finally
- Use transactions for multiple related operations

### JavaScript (Frontend)
- Use const/let appropriately (const for constants)
- Follow camelCase for variables and functions
- Handle async operations with proper error handling
- Use descriptive variable names

### General Best Practices
- Add docstrings to functions explaining purpose and parameters
- Keep functions focused on single responsibility
- Use meaningful variable names
- Comment complex logic only when necessary
- Follow Flask/SocketIO best practices for real-time apps