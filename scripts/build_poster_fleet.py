"""Blender fleet based on the Wobble GP home poster. Preserves V3/V4 sources."""
import bpy
import math
import runpy
import contextlib
import io
from pathlib import Path

PROJECT=Path(__file__).resolve().parents[1]
H=runpy.run_path(str(PROJECT/'scripts/build_fleet.py'))
coord=H['coord'];empty=H['empty'];mat=H['mat'];box=H['box'];ball=H['ellipsoid'];tube=H['tube'];cylinder=H['cylinder']

def mesh(name,parent,verts,faces,materials,indices=None,subdivide=0):
    data=bpy.data.meshes.new(name);data.from_pydata([coord(v) for v in verts],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(obj);obj.parent=parent
    for m in materials:data.materials.append(m)
    for i,p in enumerate(data.polygons):p.use_smooth=True;p.material_index=indices[i] if indices else 0
    if subdivide:
        m=obj.modifiers.new('Sculpted continuous surface','SUBSURF');m.levels=subdivide;m.render_levels=subdivide
    return obj

def torus(name,parent,m,at,radius,thickness,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,major_radius=radius,minor_radius=thickness,location=coord(at),rotation=rotation)
    return H['finish'](bpy.context.object,name,parent,m)

def wheels(root,key,axle=.83,front=.87,rear=-.92,r=.4):
    for side in [-1,1]:
        for z,is_front in [(front,True),(rear,False)]:
            suffix=('F' if is_front else 'R')+('L' if side<0 else 'R')
            steer=empty(key+'__Steer_'+suffix,root,(side*axle,r,z));spin=empty(key+'__Wheel_'+suffix,steer)
            profile=[(-.18,r*.64),(-.19,r*.80),(-.15,r*.95),(-.09,r),(.09,r),(.15,r*.95),(.19,r*.80),(.18,r*.64)]
            verts=[];faces=[];n=40
            for x,rad in profile:
                for i in range(n):
                    a=math.tau*i/n;verts.append((x,math.sin(a)*rad,math.cos(a)*rad))
            for j in range(len(profile)):
                for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,((j+1)%len(profile))*n+(i+1)%n,((j+1)%len(profile))*n+i))
            mesh('Poster_rounded_tire',spin,verts,faces,[RUBBER])
            cylinder('Recessed_hub',spin,CORAL,(side*.15,0,0),r*.63,.065,(1,0,0),40)
            torus('Polished_rim',spin,METAL,(side*.195,0,0),r*.57,.018,(0,math.pi/2,0))
            cylinder('Axle_cap',spin,IVORY,(side*.21,0,0),r*.17,.045,(1,0,0))
            for i in range(5):
                a=math.tau*i/5
                cylinder('Wheel_bolt',spin,METAL,(side*.196,math.sin(a)*r*.32,math.cos(a)*r*.32),.022,.025,(1,0,0),12)
            for x in [-.075,.075]:torus('Tread_channel',spin,DARK,(x,0,0),r-.006,.008,(0,math.pi/2,0))

def eye(root,key,index,at,size,tilt=0,squint=False):
    socket=empty(key+'__Expression_Eye_'+str(index),root,at);socket.rotation_euler.x=tilt
    ball('Poster_eye_white',socket,IVORY,(0,0,0),(size,size*(.50 if squint else 1.02),size*(.24 if squint else .4)),32)
    pupil=empty(key+'__Expression_Pupil_'+str(index),socket)
    depth=.22 if squint else .37
    ball('Iris',pupil,IRIS,(.035,-.012,size*depth),(size*.40,size*(.35 if squint else .48),size*.10),24)
    ball('Pupil',pupil,INK,(.042,-.014,size*(depth+.09)),(size*.26,size*(.25 if squint else .32),size*.06),24)
    ball('Catchlight',pupil,IVORY,(.008,size*.12,size*(depth+.15)),(size*.075,)*3,16)
    return socket

def loft(name,parent,rings,materials,selector=None):
    verts=[];faces=[];indices=[];n=64
    for z,w,bottom,top in rings:
        for i in range(n):
            a=math.tau*i/n;s=math.sin(a);c=math.cos(a)
            x=w*math.copysign(abs(s)**.65,s)*(1-.12*max(c,0))
            y=(top+bottom)/2+(top-bottom)/2*math.copysign(abs(c)**.60,c)
            verts.append((x,y,z))
    for j in range(len(rings)-1):
        for i in range(n):
            face=(j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n);faces.append(face)
            p=tuple(sum(verts[k][axis] for k in face)/4 for axis in range(3));indices.append(selector(p) if selector else 0)
    for end in [0,len(rings)-1]:
        center=len(verts);z,w,bottom,top=rings[end];verts.append((0,(bottom+top)/2,z))
        for i in range(n):
            a=end*n+i;b=end*n+(i+1)%n
            faces.append((a,b,center) if end==0 else (b,a,center));indices.append(0)
    return mesh(name,parent,verts,faces,materials,indices,2)

def gt():
    root=empty('Fleet_apex')
    rings=[(-1.56,.40,.44,.63),(-1.50,.70,.35,.83),(-1.25,.81,.34,.97),(-.75,.82,.34,1.04),(0,.82,.34,1.08),(.70,.82,.34,1.04),(1.12,.78,.35,.97),(1.46,.67,.38,.79),(1.56,.44,.47,.65)]
    loft('GT_continuous_coachwork',root,rings,[JADE,IVORY],lambda p:1 if .11<abs(p[0])<.29 and p[1]>.76 else 0)
    cabin=[(-1.05,.38,.87,1.20),(-.88,.60,.9,1.65),(-.65,.66,.91,1.78),(-.20,.65,.94,1.78),(.06,.63,.96,1.67),(.30,.60,.98,1.40),(.48,.49,.98,1.13)]
    def cabin_material(p):
        x,y,z=p
        if z>.04 and y>1.17:return 2
        if abs(x)>.50 and y>1.16 and -.78<z<-.02:return 2
        if z<-.85 and y>1.21:return 2
        return 1 if .10<abs(x)<.28 and y>1.60 else 0
    loft('GT_sculpted_cabin',root,cabin,[JADE,IVORY,GLASS],cabin_material)
    wheels(root,'apex',.83,.89,-.94,.4)
    for side in [-1,1]:
        # Wheel shoulders blend into the body, with one curved arch rather than block fenders.
        for z in [.89,-.94]:
            tube('GT_wheel_arch',root,JADE,[(side*.78,.43+math.sin(i*math.pi/12)*.46,z+math.cos(i*math.pi/12)*.46) for i in range(13)],.075)
        ball('GT_headlight_bezel',root,METAL,(side*.59,.82,1.26),(.22,.22,.13))
        ball('GT_headlight_glass',root,IVORY,(side*.59,.83,1.35),(.174,.174,.05))
        ball('GT_mirror',root,JADE,(side*.84,1.22,.05),(.13,.105,.19))
        box('GT_tail_light',root,CORAL,(side*.52,.74,-1.47),(.28,.115,.07),.045)
        box('GT_door_handle',root,METAL,(side*.792,1.02,-.30),(.035,.035,.16),.015)
        box('GT_wing_support',root,DARK,(side*.49,1.12,-1.22),(.065,.30,.10),.02)
    for i,side in enumerate([-1,1]):
        eye(root,'apex',i,(side*.275,1.425,.30),.237,-.52,True)
        brow=box('GT_angry_brow',root,JADE,(side*.27,1.525,.305),(.48,.065,.09),.03);brow.rotation_euler.y=side*.24;brow.rotation_euler.x=-.52
    box('GT_spoiler',root,JADE,(0,1.29,-1.23),(1.70,.11,.31),.05)
    tube('GT_bumper',root,JADE,[(-.64,.43,1.39),(0,.39,1.57),(.64,.43,1.39)],.07)
    tube('GT_crooked_grin',root,INK,[(-.20,.61,1.50),(.04,.57,1.54),(.30,.64,1.48)],.025)
    box('GT_number_plate',root,IVORY,(0,.405,1.59),(.36,.12,.035),.025)
    return root

def potato():
    root=empty('Fleet_potato')
    body=ball('Sculpted_Potato_Skin',root,SKIN,(0,1.23,-.04),(.85,1.00,.86),48)
    for v in body.data.vertices:
        x,y,z=v.co;v.co.x*=1+.075*math.sin(z*3+y*2);v.co.y*=1+.05*math.sin(x*4+z*3)
    box('Potato_chassis',root,JADE,(0,.40,-.08),(1.37,.23,1.80),.10)
    wheels(root,'potato',.84,.70,-.71,.39)
    eye(root,'potato',0,(-.33,1.61,.70),.33,-.12)
    eye(root,'potato',1,(.41,1.35,.72),.255,-.08)
    mouth=ball('Potato_open_grin',root,INK,(.04,1.04,.825),(.39,.165,.075));mouth.rotation_euler.y=-.10
    ball('Potato_tongue',root,CORAL,(.19,.966,.88),(.13,.06,.023))
    for i,x in enumerate([-.11,.07]):box('Potato_front_tooth',root,IVORY,(x,1.085,.90),(.155,.22-i*.02,.07),.025)
    plate=box('Potato_bumper_plate',root,METAL,(0,.40,1.02),(1.22,.23,.10),.035)
    for x in [-.46,.46]:cylinder('Bumper_bolt',root,DARK,(x,.43,1.079),.03,.018,(0,0,1),16)
    torus('Potato_steering_wheel',root,DARK,(0,.66,.98),.245,.034,(math.pi/2,0,0))
    for side in [-1,1]:
        tube('Potato_arm',root,SKIN,[(side*.72,1.06,.34),(side*.88,.85,.68),(side*.26,.75,.98)],.075)
        ball('Potato_hand',root,SKIN,(side*.25,.75,.98),(.105,.11,.09))
    sprout=empty('potato__Inspection_Sprout',root,(0,2.13,-.05))
    tube('Potato_stalk',sprout,LEAF,[(0,0,0),(.02,.27,0),(.11,.47,-.01)],.045)
    for side in [-1,1]:
        leaf=ball('Potato_leaf',sprout,LEAF,(side*.22,.39,0),(.15,.31,.06));leaf.rotation_euler.y=-side*.60
        tube('Leaf_vein',sprout,LIGHTLEAF,[(side*.06,.18,.035),(side*.22,.39,.065),(side*.37,.60,.035)],.009)
    return root

def remove(obj):
    for child in list(obj.children):remove(child)
    bpy.data.objects.remove(obj,do_unlink=True)

def build():
    global IVORY,INK,IRIS,JADE,GLASS,RUBBER,DARK,CORAL,METAL,SKIN,LEAF,LIGHTLEAF
    scene=bpy.data.scenes.new('Poster Fleet V5');bpy.context.window.scene=scene
    IVORY=mat('Poster warm ivory',(.92,.86,.68),rough=.32);INK=mat('Poster ink',(.009,.013,.012),rough=.39)
    IRIS=mat('Poster amber iris',(.15,.073,.024),rough=.32);JADE=mat('Poster turquoise enamel',(.008,.26,.195),.20,.31)
    GLASS=mat('Poster windscreen',(.013,.024,.022),.12,.23);RUBBER=mat('Poster rubber',(.018,.023,.021),rough=.87)
    DARK=mat('Poster charcoal',(.035,.046,.041),rough=.73);CORAL=mat('Poster coral',(.80,.15,.10),.18,.34)
    METAL=mat('Poster brushed alloy',(.51,.46,.34),.58,.36);SKIN=mat('Poster potato',(.69,.41,.12),rough=.8)
    LEAF=mat('Poster leaf',(.23,.43,.038),rough=.55);LIGHTLEAF=mat('Poster leaf veins',(.40,.56,.08),rough=.65)
    bs=next(n for n in JADE.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Coat Weight'].default_value=.45
    with contextlib.redirect_stdout(io.StringIO()):bpy.ops.import_scene.gltf(filepath=str(PROJECT/'public/assets/fleet-v3.glb'))
    imported={key:next(o for o in scene.objects if o.name.split('.')[0]=='Fleet_'+key) for key in ['pencil','potato','ufo','apex']}
    remove(imported['potato']);remove(imported['apex'])
    pencil=imported['pencil'];ufo=imported['ufo']
    for o in list(pencil.children):
        if any(o.name.startswith(s) for s in ['pencil__Expression_Eye','Eyebrow','Pencil_grin']):remove(o)
    for i,side in enumerate([-1,1]):
        eye(pencil,'pencil',i,(side*.265,1.31,.98),.245,-.50,True)
        brow=box('Pencil_sly_lid',pencil,mat('Pencil eyelid',(.95,.60,.035),.12,.31),(side*.265,1.40,.91),(.40,.045,.10),.022);brow.rotation_euler.y=-side*.15
    for o in list(ufo.children_recursive):
        if o.name.startswith('Navigation_lamp'):
            o.scale*=1.65;o.data.materials.clear();o.data.materials.append(mat('Warm saucer light',(.95,.58,.14),rough=.25,emission=2))
        if o.name.startswith('Alien_pilot'):o.scale*=1.20
        if o.name.startswith('Canopy') and o.type=='MESH':
            o.scale*=1.10
            for m in o.data.materials:
                p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Alpha'].default_value=.16;p.inputs['Roughness'].default_value=.12
    hover=next(o for o in ufo.children if '__Hover' in o.name)
    for o in list(hover.children):
        if '__Expression_Eye' in o.name or o.name.startswith('Mischievous_grin'):remove(o)
    eye(hover,'ufo',0,(0,1.41,.39),.255)
    ball('Alien_open_mouth',hover,INK,(0,1.115,.405),(.17,.085,.035))
    ball('Alien_tongue',hover,CORAL,(.03,1.05,.445),(.067,.07,.022))
    for x in [-.065,.02]:box('Alien_tooth',hover,IVORY,(x,1.155,.444),(.06,.045,.025),.012)
    for side in [-1,1]:
        tube('Alien_arm',hover,LEAF,[(side*.24,1.24,.10),(side*.37,1.12,.21),(side*.22,1.06,.37)],.045)
    torus('Canopy_collar',hover,METAL,(0,1.015,-.07),.60,.028)
    roots=[gt(),potato(),pencil,ufo]
    for root,key in zip(roots,['apex','potato','pencil','ufo']):
        name='Fleet_'+key;existing=bpy.data.objects.get(name)
        if existing and existing!=root:existing.name='Source_'+name
        root.name=name
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for o in root.children_recursive:o.select_set(True)
    with contextlib.redirect_stdout(io.StringIO()):
        bpy.ops.export_scene.gltf(filepath=str(PROJECT/'public/assets/fleet-v5.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True)
    for i,root in enumerate(roots):root.location.x=(i-1.5)*4
    bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT/'output/fleet-v5.blend'))
    print('Poster fleet exported', (PROJECT/'public/assets/fleet-v5.glb').stat().st_size)

if __name__=='__main__':build()
