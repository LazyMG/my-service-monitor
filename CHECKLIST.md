# CHECKLIST — 진행 단계 추적

이 파일은 **현재 작업 단계를 추적하는 살아있는 문서**다. 작업 시작 전 읽고, 항목을 끝낼 때마다 갱신한다.
레이어 순서를 지킨다: **Layer 1(로컬 완전 동작) → Layer 2(클라우드 운영) → Layer 3(고급 학습, 선택)**.

- 상태 표기: `[ ]` 미착수 · `[~]` 진행 중 · `[x]` 완료 · `[!]` 막힘/이슈
- 출처: [uptime-monitor-devops.md](uptime-monitor-devops.md) §4 로드맵

---

## 현재 상태 (Status)

- **현재 레이어**: Layer 0 — 프로젝트 셋업
- **현재 작업**: 저장소 초기화 / 모노레포 구조 결정 대기
- **다음 할 일**: 워크스페이스 도구 선택 → `apps/web`·`apps/api` 골격 생성
- **마지막 갱신**: 2026-06-16
- **블로커**: 없음

> 단계가 바뀌면 위 4줄을 갱신한다.

---

## Layer 0 — 프로젝트 셋업
- [x] 배경 문서 확보 (uptime-monitor-devops.md)
- [x] CLAUDE.md 작성 (작업 규칙·가이드)
- [x] CHECKLIST.md 작성
- [ ] 모노레포 워크스페이스 도구 선택 (pnpm / npm / yarn workspaces)
- [ ] 루트 디렉터리 레이아웃 생성 (`apps/`, `packages/`, `infra/`, `docker/`, `scripts/`)
- [ ] Git 저장소 초기화 + `.gitignore`
- [ ] 코드 품질 도구 (ESLint, Prettier, EditorConfig)

---

## Layer 1 — 동작하는 서비스 (필수 코어)
로컬에서 완전히 돌아가는 상태를 먼저 만든다.

- [ ] React + NestJS + MySQL 골격
- [ ] 체크 엔진: HTTP 헬스체크(상태코드·응답시간)
- [ ] 체크 엔진: TLS 인증서 만료일 파싱 (Node `tls` 모듈)
- [ ] Cron 스케줄러 + `checks` 이력 저장
- [ ] REST API + 대시보드(현재 상태 + 응답시간 그래프 + 인증서 D-day)
- [ ] 이메일 알림(상태 전환 감지 + `alerts` 중복 방지)
- [ ] AI 요약을 알림에 결합 (10초 타임아웃 + 템플릿 폴백)
- [ ] 멀티스테이지 Dockerfile + 이미지 슬리밍(distroless/alpine)
- [ ] Docker Compose (healthcheck, depends_on, restart policy)
- [ ] 구조화 로깅(JSON / Pino)

**Layer 1 완료 기준**: 로컬에서 대상 등록 → 주기적 체크 → 상태 전환 시 (AI 요약 포함) 이메일 알림까지 끊김 없이 동작.

---

## Layer 2 — 클라우드 운영 (DevOps 핵심)
> ⚠️ **이 레이어부터 AWS 비용 발생. [CLAUDE.md](CLAUDE.md) §4 비용 제한을 반드시 준수.**
> **착수 즉시 AWS Budgets 알림(월 $40)부터 건다.** 목표 상한 ~$30~37/월.

- [ ] **AWS Budgets 예산 알림 ($40 임계값) — 최우선**
- [ ] Terraform: VPC, 퍼블릭/프라이빗 서브넷 (**NAT GW 없이**)
- [ ] Terraform: EC2(앱, t4g.small), RDS(MySQL db.t4g.micro Single-AZ, 프라이빗), SES
- [ ] Terraform: IAM 최소권한, 보안그룹(EC2→RDS 3306만)
- [ ] cloud-init: EC2 부팅 시 Docker 설치/초기화
- [ ] GitHub Actions: 빌드·푸시·배포 + paths-filter
- [ ] GitHub Actions: OIDC로 AWS 인증(장수 키 제거)
- [ ] 빌드 캐시(actions/cache, Docker layer cache)
- [ ] Trivy 이미지 스캔 + Dependabot
- [ ] SBOM 생성 + cosign 이미지 서명
- [ ] AWS Secrets Manager로 시크릿 분리(ANTHROPIC_API_KEY, DB)
- [ ] 리소스 태깅(비용 추적)
- [ ] RDS 백업/복구 실습(스냅샷 복원, PITR)
- [ ] Makefile로 반복 작업 표준화(deploy, logs, plan…)

### 💰 비용 정리 체크 (실습 후 반드시)
- [ ] Multi-AZ 페일오버 실습했으면 → 끄기
- [ ] 안 쓰는 EC2 중지 / RDS 스냅샷 후 삭제
- [ ] 안 쓰는 EIP 해제
- [ ] `terraform destroy`로 유료 리소스 정리 확인

---

## Layer 3 — 고급 학습 (선택 · 안 해도 프로젝트는 완결)
> 로컬에서 부담 없이. **클라우드 EKS 금지(월 ~$73)** — k8s는 로컬 k3d/kind로.

- [ ] 로컬 k3d/kind에 동일 앱을 k8s로 재배포
- [ ] Deployment / Service / Ingress / ConfigMap / Secret / 리소스 limit·request
- [ ] kube-prometheus-stack(Helm): Prometheus + Grafana + Alertmanager
- [ ] 앱에 `/metrics` exporter 노출(RED/USE 지표)
- [ ] SLO/SLI 정의 + 에러 버짓
- [ ] cert-manager로 인증서 자동화
- [ ] OPA/Kyverno 정책 거버넌스

---

## 작업 메모 / 블로커 로그
> 막힌 항목, 결정 사항, 다음 세션에 이어갈 내용을 자유롭게 기록.

- (2026-06-16) 프로젝트 시작. CLAUDE.md / CHECKLIST.md 작성 완료.
