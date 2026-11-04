"""Encrypt an already consistent OPS snapshot with restic; local or S3 repository.

Usage: encrypted-backup.py init|backup|check|restore REPOSITORY PASSWORD_FILE PATH
For local repositories, REPOSITORY is an absolute directory. For S3 it is a
restic s3: URL and AWS credentials must be supplied in the caller environment.
PATH is the snapshot directory for backup, and a NEW empty directory for restore.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

IMAGE = 'restic/restic:0.19.1'


def main():
    if len(sys.argv) != 5:
        raise ValueError(__doc__)
    action, repository, password, target = sys.argv[1:]
    if action not in {'init', 'backup', 'check', 'restore'}:
        raise ValueError('Unknown action')
    password_path = Path(password).resolve(strict=True)
    if not password_path.is_file():
        raise ValueError('Password must be a regular file')
    target_path = Path(target).resolve()
    if action == 'backup':
        manifest = json.loads((target_path / 'manifest.json').read_text())
        expected = {'db.sql', 'artworks.tgz', 'worker-state.tgz'}
        if set(manifest.get('files', {})) != expected:
            raise ValueError('Complete consistent snapshot manifest is required')
        for name, checksum in manifest['files'].items():
            if hashlib.sha256((target_path / name).read_bytes()).hexdigest() != checksum:
                raise ValueError(f'Snapshot checksum mismatch: {name}')
    if action == 'restore':
        target_path.mkdir(parents=True, exist_ok=False)
        target_path.chmod(0o700)
    if action == 'init' and not target_path.exists():
        raise ValueError('PATH must exist for init')
    args = ['docker', 'run', '--rm', '--network', 'none' if not repository.startswith('s3:') else 'bridge',
            '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
            '--mount', f'type=bind,src={password_path},dst=/run/secrets/restic_password,readonly',
            '--env', 'RESTIC_PASSWORD_FILE=/run/secrets/restic_password']
    if repository.startswith('s3:'):
        if not all(os.environ.get(k) for k in ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY')):
            raise ValueError('S3 credentials must be set in caller environment')
        args += ['--env', f'RESTIC_REPOSITORY={repository}', '--env', 'AWS_ACCESS_KEY_ID', '--env', 'AWS_SECRET_ACCESS_KEY']
        if os.environ.get('AWS_SESSION_TOKEN'):
            args += ['--env', 'AWS_SESSION_TOKEN']
    else:
        repo_path = Path(repository).resolve()
        repo_path.mkdir(parents=True, exist_ok=True)
        args += ['--mount', f'type=bind,src={repo_path},dst=/repository', '--env', 'RESTIC_REPOSITORY=/repository']
    if action == 'backup':
        args += ['--mount', f'type=bind,src={target_path},dst=/snapshot,readonly']
    if action == 'restore':
        args += ['--mount', f'type=bind,src={target_path},dst=/restore']
    command = {'init': ['init'], 'backup': ['backup', '/snapshot'],
               'check': ['check', '--read-data'], 'restore': ['restore', 'latest', '--target', '/restore']}[action]
    subprocess.run(args + [IMAGE] + command, check=True)


if __name__ == '__main__':
    main()
