# ============ BROADCAST SOCIAL: likes, comments ============
# Appended to /opt/f1-hub/api.py — добавляет лайки/комментарии к трансляциям.

from pydantic import BaseModel as _SocialBaseModel
from typing import Optional as _SocialOpt


class CommentRequest(_SocialBaseModel):
    text: str
    parent_id: _SocialOpt[int] = None


def _social_db():
    import sqlite3
    conn = sqlite3.connect("/app/data/f1hub.db")
    conn.row_factory = sqlite3.Row
    return conn


def _social_user_id(request: "Request") -> _SocialOpt[int]:
    try:
        u = get_current_user(request)
        return int(u["id"])
    except Exception:
        return None


def _serialize_comment(r, my_user_id: _SocialOpt[int]) -> dict:
    return {
        "id": r["id"],
        "broadcast_id": r["broadcast_id"],
        "user_id": r["user_id"],
        "parent_id": r["parent_id"],
        "text": r["text"],
        "created_at": r["created_at"],
        "user_name": r["first_name"] or r["username"] or f"User{r['user_id']}",
        "user_username": r["username"],
        "user_photo_url": r["photo_url"],
        "likes_count": r["likes_count"] if "likes_count" in r.keys() else 0,
        "my_liked": bool(r["my_liked"]) if "my_liked" in r.keys() else False,
        "is_mine": (my_user_id == r["user_id"]) if my_user_id else False,
    }


@app.get("/api/broadcast/{broadcast_id}/social")
def broadcast_social_get(broadcast_id: int, request: Request):
    user_id = _social_user_id(request)
    conn = _social_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM broadcast_likes WHERE broadcast_id=?", (broadcast_id,))
    likes_count = cur.fetchone()["c"]
    cur.execute(
        "SELECT COUNT(*) AS c FROM broadcast_comments WHERE broadcast_id=? AND is_deleted=0",
        (broadcast_id,),
    )
    comments_count = cur.fetchone()["c"]
    my_liked = False
    if user_id:
        cur.execute(
            "SELECT 1 FROM broadcast_likes WHERE broadcast_id=? AND user_id=?",
            (broadcast_id, user_id),
        )
        my_liked = cur.fetchone() is not None
    conn.close()
    return {"likes_count": likes_count, "comments_count": comments_count, "my_liked": my_liked}


@app.post("/api/broadcast/{broadcast_id}/like")
def broadcast_like_toggle(broadcast_id: int, request: Request):
    user = get_current_user(request)
    user_id = int(user["id"])
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM broadcast_likes WHERE broadcast_id=? AND user_id=?",
        (broadcast_id, user_id),
    )
    if cur.fetchone():
        cur.execute(
            "DELETE FROM broadcast_likes WHERE broadcast_id=? AND user_id=?",
            (broadcast_id, user_id),
        )
        my_liked = False
    else:
        cur.execute(
            "INSERT INTO broadcast_likes(broadcast_id, user_id) VALUES(?,?)",
            (broadcast_id, user_id),
        )
        my_liked = True
    conn.commit()
    cur.execute("SELECT COUNT(*) AS c FROM broadcast_likes WHERE broadcast_id=?", (broadcast_id,))
    likes_count = cur.fetchone()["c"]
    conn.close()
    return {"my_liked": my_liked, "likes_count": likes_count}


@app.get("/api/broadcast/{broadcast_id}/comments")
def broadcast_get_comments(
    broadcast_id: int,
    request: Request,
    sort: str = "new",
    offset: int = 0,
    limit: int = 20,
):
    user_id = _social_user_id(request)
    limit = max(1, min(100, limit))
    offset = max(0, offset)
    order = "c.created_at DESC" if sort == "new" else "c.created_at ASC"
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT c.id, c.broadcast_id, c.user_id, c.parent_id, c.text, c.created_at,
               u.first_name, u.username, u.photo_url,
               (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id=c.id) AS likes_count,
               EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id=c.id AND cl.user_id=?) AS my_liked
        FROM broadcast_comments c
        LEFT JOIN users u ON u.user_id = c.user_id
        WHERE c.broadcast_id=? AND c.is_deleted=0
        ORDER BY {order}
        LIMIT ? OFFSET ?
        """,
        (user_id or 0, broadcast_id, limit, offset),
    )
    rows = cur.fetchall()
    cur.execute(
        "SELECT COUNT(*) AS c FROM broadcast_comments WHERE broadcast_id=? AND is_deleted=0",
        (broadcast_id,),
    )
    total = cur.fetchone()["c"]
    conn.close()
    return {
        "comments": [_serialize_comment(r, user_id) for r in rows],
        "total": total,
    }


@app.post("/api/broadcast/{broadcast_id}/comment")
def broadcast_post_comment(
    broadcast_id: int, req: CommentRequest, request: Request
):
    user = get_current_user(request)
    user_id = int(user["id"])
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty comment")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="Comment too long (max 1000)")
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO broadcast_comments(broadcast_id, user_id, parent_id, text) VALUES(?,?,?,?)",
        (broadcast_id, user_id, req.parent_id, text),
    )
    cid = cur.lastrowid
    conn.commit()
    cur.execute(
        """
        SELECT c.id, c.broadcast_id, c.user_id, c.parent_id, c.text, c.created_at,
               u.first_name, u.username, u.photo_url,
               0 AS likes_count, 0 AS my_liked
        FROM broadcast_comments c
        LEFT JOIN users u ON u.user_id = c.user_id
        WHERE c.id=?
        """,
        (cid,),
    )
    r = cur.fetchone()
    conn.close()
    return _serialize_comment(r, user_id)


@app.post("/api/comment/{comment_id}/like")
def comment_like_toggle(comment_id: int, request: Request):
    user = get_current_user(request)
    user_id = int(user["id"])
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM comment_likes WHERE comment_id=? AND user_id=?",
        (comment_id, user_id),
    )
    if cur.fetchone():
        cur.execute(
            "DELETE FROM comment_likes WHERE comment_id=? AND user_id=?",
            (comment_id, user_id),
        )
        my_liked = False
    else:
        cur.execute(
            "INSERT INTO comment_likes(comment_id, user_id) VALUES(?,?)",
            (comment_id, user_id),
        )
        my_liked = True
    conn.commit()
    cur.execute(
        "SELECT COUNT(*) AS c FROM comment_likes WHERE comment_id=?", (comment_id,)
    )
    likes_count = cur.fetchone()["c"]
    conn.close()
    return {"my_liked": my_liked, "likes_count": likes_count}


@app.delete("/api/comment/{comment_id}")
def comment_delete(comment_id: int, request: Request):
    user = get_current_user(request)
    user_id = int(user["id"])
    conn = _social_db()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM broadcast_comments WHERE id=?", (comment_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    is_owner = row["user_id"] == user_id
    is_admin = user_id in (ADMIN_IDS if "ADMIN_IDS" in globals() else set())
    if not (is_owner or is_admin):
        conn.close()
        raise HTTPException(status_code=403, detail="Forbidden")
    cur.execute("UPDATE broadcast_comments SET is_deleted=1 WHERE id=?", (comment_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
