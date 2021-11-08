let xrSession
let gl
let xrReferenceSpace
let animationFrameRequestID
let web_xr_render_scene
let buffersCreated = false
let firstLoop = true
let canvas = document.querySelector('canvas')
document.querySelector('button').addEventListener('click', doXRStuff)

// source: https://github.com/WonderlandEngine/emscripten-webxr/blob/d1a9107cff96de05c67e0d67165fa3eff74a7959/library_webxr.js#L15
function nativizeMatrix(offset, mat) {
    for (var i = 0; i < 16; ++i) {
        setValue(offset + i*4, mat[i], 'float');
    }

    return offset + 16*4;
}
// slightly adapted from https://github.com/WonderlandEngine/emscripten-webxr/blob/d1a9107cff96de05c67e0d67165fa3eff74a7959/library_webxr.js#L96
// size of two 4x4 float matrices, view and projection
const SIZE_OF_WEBXR_VIEW = (16 + 16)*4;
function doXRStuff() {
    console.log("Let's do this!!!!!!!!!!!!!")
    web_xr_render_scene = Module.cwrap('webxr_render_scene', null, ['number'])
    const xr = navigator.xr
    if (!!!xr) {
        alert("Nope")
        return
    }
    navigator.xr.isSessionSupported('immersive-vr')
        .then(function(isOK) {
            if (!isOK) {
                alert('Still nope')
                return
            }
            return xr.requestSession('immersive-vr')
        })
        .then(function(xrs) {
            xrSession = xrs
            gl = canvas.getContext('webgl2', { xrCompatible: true })
            gl.makeXRCompatible()
            .then(function() {
                xrSession.updateRenderState({
                    baseLayer: new XRWebGLLayer(xrSession, gl)
                });
                return xrSession.requestReferenceSpace('local')    
            })
            .then((refSpace) => {
                    xrReferenceSpace = refSpace.getOffsetReferenceSpace(
                        new XRRigidTransform({x: 0, y: 0, z: -7, w: 1}, {x: 0, y: 0, z: 0, w: 1}));
                    animationFrameRequestID = xrSession.requestAnimationFrame(drawFrame);
                });
        })
}

function createBuffers(time, frame) {
    let pose = frame.getViewerPose(xrReferenceSpace)
    if (!!!pose) {
        return false
    }
    let glLayer = frame.session.renderState.baseLayer;
    let viewport = glLayer.getViewport(pose.views[0])
    buffersCreated = true
    return true
}

function printMatrix(mat) {
    console.log('projectionMatrix is ', `
    [${getValue(mat, 'float')}, ${getValue(mat + 4, 'float')}, ${getValue(mat + 8, 'float')}, ${getValue(mat + 12, 'float')}]
    [${getValue(mat + 16, 'float')}, ${getValue(mat + 20, 'float')}, ${getValue(mat + 24, 'float')}, ${getValue(mat + 28, 'float')}]
    [${getValue(mat + 32, 'float')}, ${getValue(mat + 36, 'float')}, ${getValue(mat + 40, 'float')}, ${getValue(mat + 44, 'float')}]
    [${getValue(mat + 48, 'float')}, ${getValue(mat + 52, 'float')}, ${getValue(mat + 56, 'float')}, ${getValue(mat + 60, 'float')}]
    `)
}

function drawFrame(time, frame) {
    let session = frame.session;
    animationFrameRequestID = session.requestAnimationFrame(drawFrame);
    if (!buffersCreated) {
        while(!createBuffers(time, frame)) {
        }
    } 
    let adjustedRefSpace = xrReferenceSpace;
    let pose = null;

    pose = frame.getViewerPose(adjustedRefSpace);

    if (pose) {
        let glLayer = session.renderState.baseLayer;

        gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);

        // gl.clearBufferfv(gl.COLOR, glLayer.framebuffer, [1, 0, 0, 1])
        // gl.clearBufferfi(gl.DEPTH_STENCIL, glLayer.framebuffer, 1, 1)
        // gl.clearColor(1.0, 0, 0, 1.0);
        // gl.clearDepth(1.0);                 // Clear everything
        // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        lastFrameTime = time;

        // Module.ccall('webxr_clear_framebuffer', null, [], null, {async: true})()

        let viewMatrices = Module._malloc(SIZE_OF_WEBXR_VIEW * 2)

        for (let view of pose.views) {
            let viewport = glLayer.getViewport(view);
            if (firstLoop) {
                firstLoop = false
                let webxr_set_eye_measurements = Module.cwrap('webxr_set_eye_measurements', null, ['number', 'number'], {async: true})
                webxr_set_eye_measurements(viewport.width, viewport.height)
            }
            gl.viewport(0, 0, viewport.width * pose.views.length, viewport.height);
            gl.canvas.width = viewport.width * pose.views.length;
            gl.canvas.height = viewport.height;

            let offset = viewMatrices + SIZE_OF_WEBXR_VIEW * (view.eye === 'left' ? 0 : 1)
            offset = nativizeMatrix(offset, view.transform.inverse.matrix)
            offset = nativizeMatrix(offset, view.projectionMatrix)
            web_xr_render_scene()
        }

        let webxr_set_camera_matrices = Module.cwrap('webxr_set_camera_matrices', null, ['number'])
        webxr_set_camera_matrices(viewMatrices)
        // printMatrix(viewMatrices)
        // printMatrix(viewMatrices + 64)
        // printMatrix(viewMatrices + 128)
        // printMatrix(viewMatrices + 192)
        _free(viewMatrices)
    }
}
