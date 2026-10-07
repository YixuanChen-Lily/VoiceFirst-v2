from backend.app.core.database import parse_database_url


def test_connection_string_with_awkward_password_characters():
    url = parse_database_url("postgresql://postgres.ref:p@ss/w*rd:x@host.example.com:6543/postgres?sslmode=require")

    assert (url.username, url.password) == ("postgres.ref", "p@ss/w*rd:x")
    assert (url.host, url.port, url.database) == ("host.example.com", 6543, "postgres")
