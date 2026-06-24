"""Create the pgvector extension + all tables (dev convenience).

Usage:
    uv run python -m scripts.init_db
"""

import asyncio

from app.db import engine, init_models


async def main() -> None:
    await init_models()
    await engine.dispose()
    print("✓ Database initialized (pgvector extension + tables).")


if __name__ == "__main__":
    asyncio.run(main())
