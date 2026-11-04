"""Isolated crash fixture: delay one fake split; never enabled in normal serving."""
import os,runpy,sys,time
if os.environ.get('UAM_ENV')!='test' or os.environ.get('UAM_FAKE_MODELS')!='1':raise RuntimeError('Only fake test workers allowed')
sys.path.insert(0,'/app/serving')
from adapters.fake import FakeAdapter
original=FakeAdapter.run
def slow(self,job):
 if job.stage_kind=='split':time.sleep(20)
 return original(self,job)
FakeAdapter.run=slow
sys.argv=['workers.main','--group','cpu_vision']
runpy.run_module('workers.main',run_name='__main__')
