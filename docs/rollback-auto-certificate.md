# Sao lưu và khôi phục trước tính năng vân tay chứng chỉ

Đã tạo bản sao lưu ngày 06/09/2026, trước khi cập nhật nhánh `main`.
Tag dùng chung ở hai repo: `backup/pre-auto-cert-20260906-000534`.

| Repo | Commit cũ được sao lưu | Commit tính năng cần revert |
|---|---|---|
| v2Pro | `d0179ce9a622fefa1899bfec4d3b9eb4a2066bc7` | `9627107139fbf453b7db8b16d5b67ee7cc67281a` |
| v2nodePro | `20b7b31517b9c6f997df8b10b4b7fb3badc5e047` | `84b997259cd39e86d573f06e998d6bf6f588b512` |

- [Bản cũ v2Pro trên GitHub](https://github.com/fsh2502/v2Pro/tree/backup/pre-auto-cert-20260906-000534)
- [Bản cũ v2nodePro trên GitHub](https://github.com/fsh2502/v2nodePro/tree/backup/pre-auto-cert-20260906-000534)

## Quay lại mã cũ trên GitHub

Thực hiện trong checkout của đúng repo, với working tree sạch. Các lệnh dưới
đây tạo commit đảo ngược tính năng, giữ nguyên lịch sử và tag sao lưu.
Nếu đã có thay đổi mới gây xung đột, xử lý xung đột và kiểm tra trước khi push;
có thể hủy thao tác bằng `git revert --abort`.

Trong **v2Pro**:

```sh
git switch main
git pull --ff-only origin main
git revert --no-edit 9627107139fbf453b7db8b16d5b67ee7cc67281a
git push origin main
```

Trong **v2nodePro**:

```sh
git switch main
git pull --ff-only origin main
git revert --no-edit 84b997259cd39e86d573f06e998d6bf6f588b512
git push origin main
```

Mã trên GitHub thay đổi không đồng nghĩa VPS đã đổi phiên bản. Sau khi revert,
triển khai lại panel và build/cập nhật lại binary node theo quy trình đang dùng.
Panel không có migration DB mới trong tính năng này. Sau khi thay mã panel,
chạy `php artisan optimize:clear` và khởi động lại tiến trình panel dài hạn nếu có.

## Lấy nguyên bản mã nguồn cũ để kiểm tra hoặc build

Trong từng repo, có thể tạo một worktree riêng ở đúng tag cũ:

```sh
git fetch origin --tags
git worktree add ../before-auto-certificate backup/pre-auto-cert-20260906-000534
```

Chọn đường dẫn khác nếu `../before-auto-certificate` đã tồn tại. Với node, build
trong worktree cũ bằng Go phù hợp `go.mod`:

```sh
GOEXPERIMENT=jsonv2 CGO_ENABLED=0 go build -trimpath -o v2node .
```

## Bản ZIP trên máy

Thư mục: `C:/Users/Admin/v2Pro-backups/20260906-000534`.

| File | SHA-256 |
|---|---|
| `v2Pro-before-auto-cert.zip` | `997d547fbf29a9d807cca978a7faa5aa86a3cbd72832cd08c6ee8141c06c95f4` |
| `v2nodePro-before-auto-cert.zip` | `f7e026c0c6c6f437439d4000905cce9235da934c2e9bdde733d2709efaeee499` |

Cả hai ZIP đã được kiểm tra tính toàn vẹn. Đây là sao lưu mã nguồn theo Git;
không bao gồm DB, `.env`, chứng chỉ riêng hoặc binary đang chạy trên VPS.
