{{/*
Expand the chart name.
*/}}
{{- define "v9-fingerprint-verify.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "v9-fingerprint-verify.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Common labels.
*/}}
{{- define "v9-fingerprint-verify.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{ include "v9-fingerprint-verify.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels.
*/}}
{{- define "v9-fingerprint-verify.selectorLabels" -}}
app.kubernetes.io/name: {{ include "v9-fingerprint-verify.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
ServiceAccount name：create=true 时默认为 fullname，可被 existingName 覆盖；
create=false 时回退到 default（可被 existingName 覆盖）。
*/}}
{{- define "v9-fingerprint-verify.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "v9-fingerprint-verify.fullname" .) .Values.serviceAccount.existingName -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.existingName -}}
{{- end -}}
{{- end -}}

{{/*
baseline ConfigMap 名称：优先使用既有 ConfigMap，否则拼接 <fullname>-baseline。
*/}}
{{- define "v9-fingerprint-verify.baselineConfigMap" -}}
{{- if .Values.baseline.existingConfigMap -}}
{{- .Values.baseline.existingConfigMap -}}
{{- else -}}
{{- printf "%s-baseline" (include "v9-fingerprint-verify.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
目标主机：service.hostOverride 非空时直接使用，否则按
<service.name>.<service.namespace>.svc 生成 Service DNS。
*/}}
{{- define "v9-fingerprint-verify.targetHost" -}}
{{- if .Values.service.hostOverride -}}
{{- .Values.service.hostOverride -}}
{{- else -}}
{{- printf "%s.%s.svc" .Values.service.name .Values.service.namespace -}}
{{- end -}}
{{- end -}}

{{/*
共享 Pod 模板（供 Job / CronJob 复用）。
输出以 metadata: 起始，调用方需自行 nindent 到对应层级。

用法：
  Job:      {{ include "v9-fingerprint-verify.fullPodTemplate" . | nindent 4 }}
  CronJob:  {{ include "v9-fingerprint-verify.fullPodTemplate" . | nindent 8 }}
*/}}
{{- define "v9-fingerprint-verify.fullPodTemplate" -}}
metadata:
  labels:
    {{- include "v9-fingerprint-verify.selectorLabels" . | nindent 4 }}
  {{- with .Values.podAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  serviceAccountName: {{ include "v9-fingerprint-verify.serviceAccountName" . }}
  restartPolicy: {{ .Values.job.restartPolicy | default "Never" }}
  {{- with .Values.imagePullSecrets }}
  imagePullSecrets:
    {{- toYaml . | nindent 2 }}
  {{- end }}
  {{- with .Values.podSecurityContext }}
  securityContext:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.nodeSelector }}
  nodeSelector:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.affinity }}
  affinity:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.tolerations }}
  tolerations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  containers:
    - name: verifier
      image: "{{ .Values.images.pythonRegistry }}/{{ .Values.images.pythonImage }}:{{ .Values.images.pythonTag }}"
      imagePullPolicy: IfNotPresent
      command:
        - python
        - /opt/verifier/verify-embedding-fingerprint.py
      env:
        - name: TARGET_HOST
          value: {{ include "v9-fingerprint-verify.targetHost" . | quote }}
        - name: TARGET_PORT
          value: {{ .Values.service.port | quote }}
        - name: TARGET_SERVICE
          value: {{ .Values.service.name | quote }}
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: V9_BASELINE_SHA
          valueFrom:
            configMapKeyRef:
              name: {{ include "v9-fingerprint-verify.baselineConfigMap" . }}
              key: baseline.sha
        - name: BASELINE_SHA_OVERRIDE
          value: {{ .Values.baseline.sha | quote }}
        - name: VERIFY_TIMEOUT
          value: {{ .Values.runtime.verifyTimeout | quote }}
        - name: FAIL_FAST
          value: {{ .Values.runtime.failFast | quote }}
        - name: RESULT_JSON
          value: {{ .Values.result.jsonPath | quote }}
        {{- with .Values.runtime.extraEnv }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      {{- with .Values.securityContext }}
      securityContext:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      resources:
        {{- toYaml .Values.resources | nindent 8 }}
      volumeMounts:
        - name: verifier-script
          mountPath: /opt/verifier
          readOnly: true
        - name: fingerprint-baseline
          mountPath: /etc/fingerprint
          readOnly: true
  volumes:
    - name: verifier-script
      configMap:
        name: {{ include "v9-fingerprint-verify.fullname" . }}-script
    - name: fingerprint-baseline
      configMap:
        name: {{ include "v9-fingerprint-verify.baselineConfigMap" . }}
{{- end -}}
