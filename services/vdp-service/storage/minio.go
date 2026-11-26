package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinIO struct {
	Client *minio.Client
	Bucket string
}

func NewMinIO(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*MinIO, error) {
	cli, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	exists, err := cli.BucketExists(ctx, bucket)
	if err != nil {
		return nil, err
	}
	if !exists {
		if err := cli.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, err
		}
	}
	return &MinIO{Client: cli, Bucket: bucket}, nil
}

func (m *MinIO) PutObject(ctx context.Context, objectKey string, r io.Reader, size int64, contentType string) error {
	_, err := m.Client.PutObject(ctx, m.Bucket, objectKey, r, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	return err
}

func (m *MinIO) GetObject(ctx context.Context, objectKey string) (io.ReadCloser, minio.ObjectInfo, error) {
	obj, err := m.Client.GetObject(ctx, m.Bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return nil, minio.ObjectInfo{}, err
	}
	info, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		return nil, minio.ObjectInfo{}, err
	}
	return obj, info, nil
}

func SafeObjectKey(parts ...string) string {
	clean := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = strings.ReplaceAll(p, "..", "")
		p = strings.ReplaceAll(p, "\\", "/")
		p = strings.ReplaceAll(p, " ", "-")
		if p != "" {
			clean = append(clean, p)
		}
	}
	return strings.Join(clean, "/")
}

func ObjectKeyForProcedure(procID, filename string) string {
	return SafeObjectKey("procedures", procID, fmt.Sprintf("svdsp-%s", filename))
}

func ObjectKeyForReport(reportID, filename string) string {
	return SafeObjectKey("reports", reportID, filename)
}
