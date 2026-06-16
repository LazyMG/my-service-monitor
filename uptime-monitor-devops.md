# 가용성 모니터링 서비스 — DevOps 학습 프로젝트

배포된 공인망 서비스(ivh.co.kr 등)의 HTTP 헬스체크 / TLS 인증서 만료 / 응답시간 이력을 추적하고, 이상 발생 시 AI 요약을 곁들인 이메일 알림을 보내는 셀프 호스팅 모니터링 도구.

이 문서의 목적은 "작동하는 작은 앱"에 DevOps 체크리스트 항목을 **의도적으로** 녹여 학습 대상으로 삼는 것이다. 핵심 원칙은 다음과 같다.

> **먼저 단순하게 동작시키고(Layer 1), 그 위에 운영·학습 레이어를 얹는다(Layer 2~3).**
> 한 번에 다 넣으면 앱은 영영 안 돌아간다.

---

## 0. 설계 원칙

- **graceful degradation** — AI 요약(외부 LLM)이 실패해도 알림은 무조건 나간다. LLM은 거들 뿐, 알림 전달이 본체.
- **억지로 넣는다는 자각** — 이 앱 규모엔 불필요하지만 학습 위해 넣는 항목(Terraform, Prometheus, OIDC 등)과, 앱이 실제로 필요로 하는 항목을 구분한다.
- **넣은 것과 뺀 것 양쪽에 이유를 둔다** — k8s·트레이싱·GPU·Backstage를 "오버엔지니어링이라 뺐다"고 설명할 수 있는 것도 엔지니어링 판단력이다.
- **감시자와 감시 대상을 분리한다** — 모니터링 앱을 감시 대상과 같은 곳에 두지 않는다. RDS를 EC2와 분리하는 것이 첫 단계.

---

## 1. 기술 스택

### 애플리케이션
| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트엔드 | React + Vite | 대시보드: 현재 상태 + 응답시간 그래프 + 인증서 D-day |
| 백엔드 | NestJS | Cron 스케줄러, 체크 엔진, REST API |
| DB | MySQL | TypeORM. 로컬은 컨테이너, 배포는 RDS |
| 체크 로직 | Node `tls` 모듈 + HTTP | TLS 핸드셰이크에서 인증서 만료일 파싱 |
| AI 요약 | Anthropic API (Haiku) | 상태 전환 시에만 호출, 타임아웃+폴백 |
| 메일 | AWS SES | 인증서 임박 / 다운 감지 알림 |

### 인프라 / 운영
| 영역 | 선택 |
|---|---|
| 컨테이너 | Docker 멀티스테이지 빌드, distroless/alpine 슬리밍, Docker Compose |
| IaC | Terraform (VPC·EC2·RDS·SES·IAM·보안그룹), cloud-init |
| CI/CD | GitHub Actions (paths-filter, OIDC, 빌드 캐시) |
| 공급망 보안 | Trivy(이미지 스캔), Dependabot, SBOM, cosign 서명 |
| 시크릿 | GitHub Secrets → AWS Secrets Manager |
| 관측성 | 구조화 로깅(JSON/Pino), (선택) Prometheus + Grafana |
| 비용 | AWS Budgets 예산 알림, 리소스 태깅 |
| 자동화 | Bash/Python 스크립트, Makefile |

---

## 2. 데이터 모델

```
targets   모니터링 대상
  id, name, url, check_interval, enabled, created_at

checks    체크 이력 (시계열)
  id, target_id, checked_at, status_code, response_time_ms,
  is_up, cert_expires_at, error_message

alerts    알림 발송 이력 (중복 발송 방지)
  id, target_id, type(cert_expiry|down), sent_at, resolved_at
```

---

## 3. AI 요약 알림 파이프라인

```
Cron 체크 → checks 저장(항상) → 상태 전환 판정
  변화 없으면 끝
  변화 있으면 ↓
최근 이력 수집 → LLM 호출(요약)
  성공 → 요약 텍스트
  실패/타임아웃(10초) → 템플릿 폴백   ★
이메일 발송(SES) + alerts 기록
```

설계 포인트
- **LLM은 알림 차단자가 되면 안 된다** — 짧은 타임아웃 + try/catch + 템플릿 폴백.
- **상태 전환에만 호출** — 매 체크마다 부르면 비용·노이즈 폭발. UP→DOWN, 복구 시점에만.
- **출력 형식 고정** — 2~3문장 요약 + 추정 원인 + 심각도(낮음/중간/높음).
- **모델은 Haiku** — 요약/분류엔 충분, 빠르고 저렴. 호출당 1원 미만.

---

## 4. 3레이어 로드맵

### Layer 1 — 동작하는 서비스 (필수 코어)
로컬에서 완전히 돌아가는 상태를 먼저 만든다.

- [ ] React + NestJS + MySQL 골격
- [ ] 체크 엔진: HTTP 헬스체크(상태코드·응답시간)
- [ ] 체크 엔진: TLS 인증서 만료일 파싱
- [ ] Cron 스케줄러 + checks 이력 저장
- [ ] REST API + 대시보드(현재 상태 + 그래프)
- [ ] 이메일 알림(상태 전환 감지 + 중복 방지)
- [ ] AI 요약을 알림에 결합(폴백 포함)
- [ ] 멀티스테이지 Dockerfile + 이미지 슬리밍
- [ ] Docker Compose (healthcheck, depends_on, restart policy)
- [ ] 구조화 로깅(JSON)

### Layer 2 — 클라우드 운영 (DevOps 핵심)
필수 항목 + 의도적으로 넣는 학습 항목.

- [ ] Terraform: VPC, 퍼블릭/프라이빗 서브넷
- [ ] Terraform: EC2(앱), RDS(MySQL, 프라이빗), SES
- [ ] Terraform: IAM 최소권한, 보안그룹(EC2→RDS 3306만)
- [ ] cloud-init: EC2 부팅 시 Docker 설치/초기화
- [ ] GitHub Actions: 빌드·푸시·배포 + paths-filter
- [ ] GitHub Actions: OIDC로 AWS 인증(장수 키 제거)
- [ ] 빌드 캐시(actions/cache, Docker layer cache)
- [ ] Trivy 이미지 스캔 + Dependabot
- [ ] SBOM 생성 + cosign 이미지 서명
- [ ] AWS Secrets Manager로 시크릿 분리(ANTHROPIC_API_KEY, DB)
- [ ] AWS Budgets 예산 알림 + 리소스 태깅
- [ ] RDS 백업/복구 실습(스냅샷 복원, PITR)
- [ ] Makefile로 반복 작업 표준화(deploy, logs, plan…)

### Layer 3 — 고급 학습 (선택 · 안 해도 프로젝트는 완결)
로컬에서 부담 없이.

- [ ] 로컬 k3d/kind에 동일 앱을 k8s로 재배포
- [ ] Deployment / Service / Ingress / ConfigMap / Secret / 리소스 limit·request
- [ ] kube-prometheus-stack(Helm): Prometheus + Grafana + Alertmanager
- [ ] 앱에 `/metrics` exporter 노출(RED/USE 지표)
- [ ] SLO/SLI 정의 + 에러 버짓(가용성 모니터링 주제와 개념 일치)
- [ ] cert-manager로 인증서 자동화
- [ ] OPA/Kyverno 정책 거버넌스

---

## 5. 체크리스트 매핑 — 넣은 것 / 뺀 것

### 진짜 필요 (앱·배포에 실제 필요)
Docker 멀티스테이지·Compose, GitHub Actions 기본 CI/CD, AWS 자원(EC2·RDS·SES), 시크릿(최소 GitHub Secrets), 예산 알림, 구조화 로깅.

### 의도적으로 넣음 (학습 목적 — 앱은 없어도 돌아감)
| 항목 | 왜 억지인가 | 왜 넣는가 |
|---|---|---|
| Terraform | 자원 10개 미만은 콘솔 클릭이 더 빠름 | IaC는 DevOps 핵심, 가치 최상위 |
| Prometheus+Grafana | 자체 React 그래프로 충분 | exporter 패턴 학습 |
| OIDC 인증 | 액세스 키로도 작동 | 보안 모범사례 |
| Trivy/SBOM/cosign | 단일 사용자 앱에 공급망 위협 희박 | 2026 트렌드 대응 |
| cloud-init | EC2 한 대는 SSH 수동 설치 가능 | 프로비저닝 자동화 연습 |
| Makefile | 명령어 직접 입력 가능 | 반복 작업 표준화 |

### 뺀 것 (억지 정도·규모 불일치가 과함)
| 항목 | 이유 |
|---|---|
| 쿠버네티스(클라우드 EKS) | 컨트롤 플레인만 월 ~$73. 학습은 로컬 k3d로 대체 |
| OpenTelemetry 트레이싱 | 단일 백엔드라 추적할 "분산"이 없음 |
| ELK 로그 집계 | Elasticsearch가 무겁고 과함(필요시 Loki) |
| 배포 전략 실전(blue-green/canary) | 단일 사용자라 무중단 니즈 약함, 개념만 |
| Ansible | 서버 한 대엔 과함, cloud-init으로 충분 |
| GPU 워크로드 / 모델 서빙 | 이 앱의 AI는 API 호출, GPU 무관 |
| Backstage / IDP | 조직 규모 도구, 1인 프로젝트엔 무의미 |

---

## 6. AWS 비용 메모 (서울 리전, 상시 가동 기준)

| 항목 | 사양 | 월 비용(USD) |
|---|---|---|
| RDS MySQL | db.t4g.micro, Single-AZ | ~$13~16 |
| RDS 스토리지 | gp3 20GB | ~$2~3 |
| RDS 백업 | provisioned 만큼 무료 | $0 |
| EC2 앱 서버 | t4g.small | ~$13~15 |
| EC2 스토리지 | EBS gp3 20GB | ~$2 |
| SES | 월 수십 통 | ~$0 |
| 데이터 전송 | 소량 | ~$1 |
| **합계** | | **약 $30~37 / 월** |

비용 관리
- **Multi-AZ는 학습 단계 불필요** — 켜면 RDS 두 배. 페일오버 한 번 실습 후 끄기.
- **안 쓸 땐 끄기** — EC2 중지로 인스턴스 과금 정지. RDS는 중지 시 최대 7일 후 자동 재시작이라, 장기 미사용은 스냅샷 뜨고 삭제.
- **NAT Gateway 함정** — 프라이빗 서브넷 외부 통신용 NAT GW는 월 $35~40. 이 앱 RDS는 외부로 나갈 일 없으니 **NAT GW 없이 설계**.
- **EIP 주의** — 안 쓰는 탄력적 IP에 소액 과금.
- **AWS Budgets 알림(무료)** — 월 $40 임계값으로 걸어두기. 비용 인식 항목이자 사고 방지.

---

## 7. 면접용 한 줄 정리

> 작은 가용성 모니터링 앱에 IaC(Terraform)·안전한 CI/CD(OIDC)·메트릭 기반 운영·공급망 보안을 **의도적으로** 적용한 DevOps 쇼케이스. 동시에 k8s(클라우드)·분산 트레이싱·GPU 인프라는 이 규모엔 오버엔지니어링이라 판단해 제외했다. 넣은 것과 뺀 것 모두 규모 대비 가치 판단에 근거한다.
