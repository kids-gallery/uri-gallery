# 개발용 가짜 엔진(SD_04 10-1). 이름과 응답에 dev-fake를 드러내고, 결과를 지어내지 않는다.
FROM python:3.11-slim
COPY engine-dev/server.py /srv/server.py
USER nobody
EXPOSE 9561
HEALTHCHECK --interval=5s --timeout=2s --retries=5 CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:9561/ping',timeout=2).status==200 else 1)"
CMD ["python", "/srv/server.py"]
